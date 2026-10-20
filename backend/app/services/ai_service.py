import json
import logging
import re
import time
from typing import Dict, List, Optional
import httpx
from openai import OpenAI
from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are TubePilot AI, an expert YouTube comment assistant powered by local AI.
Your goal is to generate thoughtful, natural, and highly engaging comments based ONLY on the provided video information (title, channel, description, and transcript snippet).

CRITICAL CONSTRAINTS:
1. Never fabricate or invent visual scenes or facts that are not present in the provided metadata or transcript.
2. If only metadata (title/description) is available and transcript is missing, craft comments that reflect that context without falsely claiming to have watched visual scenes.
3. Always respect the requested language (English, Hindi, or Hinglish) and requested length/word count.
4. Hindi comments should be written in natural Devanagari script or Hinglish (Latin script) depending on the instruction.
5. Hinglish should be modern, natural conversational Hindi written in Roman script (e.g. "Bhai kya shaandar video hai, style aur pacing kamaal ka laga!").
6. Keep tone conversational, human, and appreciative. Avoid generic spammy praise.
7. Return a valid JSON object matching the requested schema.
"""

class AIService:
    def __init__(self):
        self.ollama_base_url = settings.OLLAMA_BASE_URL
        self.ollama_model = settings.OLLAMA_MODEL

    def _get_openai_client(self) -> Optional[OpenAI]:
        if settings.has_openai:
            try:
                return OpenAI(api_key=settings.OPENAI_API_KEY)
            except Exception as e:
                logger.error(f"Error initializing OpenAI client: {e}")
        return None

    async def test_ollama_connection(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ) -> Dict:
        """
        Tests connectivity to local Ollama server and checks if the configured model is available.
        """
        start_time = time.time()
        active_url = (base_url or settings.OLLAMA_BASE_URL).rstrip('/')
        active_model = model or settings.OLLAMA_MODEL
        url = f"{active_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url)
                latency = int((time.time() - start_time) * 1000)
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name") for m in data.get("models", [])]
                    model_match = any(
                        active_model == m or active_model in m
                        for m in models
                    )
                    if model_match:
                        return {
                            "success": True,
                            "provider": "ollama",
                            "model": active_model,
                            "available_models": models,
                            "message": f"Successfully connected to Ollama at {active_url}. Model '{active_model}' is ready.",
                            "latency_ms": latency
                        }
                    else:
                        return {
                            "success": True,
                            "provider": "ollama",
                            "model": active_model,
                            "available_models": models,
                            "message": f"Connected to Ollama, but model '{active_model}' was not found in installed models ({', '.join(models) if models else 'none'}). You can pull it using 'ollama pull {active_model}'.",
                            "latency_ms": latency
                        }
                else:
                    return {
                        "success": False,
                        "provider": "ollama",
                        "model": active_model,
                        "error": f"Ollama returned HTTP status {res.status_code}: {res.text}",
                        "latency_ms": latency
                    }
        except httpx.ConnectError:
            return {
                "success": False,
                "provider": "ollama",
                "model": active_model,
                "error": f"Cannot connect to Ollama at {active_url}. Please ensure the Ollama service is running on your machine (run 'ollama serve' or start Ollama app).",
                "latency_ms": int((time.time() - start_time) * 1000)
            }
        except Exception as e:
            return {
                "success": False,
                "provider": "ollama",
                "model": active_model,
                "error": f"Connection test failed: {str(e)}",
                "latency_ms": int((time.time() - start_time) * 1000)
            }

    async def _call_ollama_chat(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Sends chat request to local Ollama server using the required specification:
        POST http://localhost:11434/api/chat
        {
          "model": "qwen2.5:7b",
          "messages": [
            {
              "role": "user",
              "content": "..."
            }
          ],
          "stream": false
        }
        """
        endpoint = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": messages,
            "stream": False
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(endpoint, json=payload)
            if res.status_code != 200:
                raise RuntimeError(
                    f"Ollama server returned error (HTTP {res.status_code}): {res.text}"
                )
            data = res.json()
            message = data.get("message", {})
            content = message.get("content", "")
            if not content:
                raise RuntimeError("Ollama returned an empty message content response.")
            return content

    def _extract_json_or_fallback(self, raw_text: str, videos_info: List[Dict], prompt: str, language: str) -> Dict:
        """
        Robust parser that extracts JSON comments from LLM response or parses structured text.
        """
        # Try finding json markdown fence
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_text, re.DOTALL)
        candidate_json = json_match.group(1) if json_match else None

        if not candidate_json:
            # Try finding first { and last }
            start = raw_text.find("{")
            end = raw_text.rfind("}")
            if start != -1 and end != -1 and end > start:
                candidate_json = raw_text[start:end+1]

        if candidate_json:
            try:
                parsed = json.loads(candidate_json)
                raw_comments = parsed.get("comments", [])
                analysis_summary = parsed.get("analysis_summary", "")

                def _norm_lang(l_val: str) -> str:
                    lv = (l_val or "").lower().strip()
                    if "hindi" in lv or lv == "hi":
                        return "hi"
                    if "hinglish" in lv:
                        return "hinglish"
                    return "en"

                formatted = []
                for rc in raw_comments:
                    vid = rc.get("video_id")
                    v_match = next((v for v in videos_info if v.get("video_id") == vid), videos_info[0] if videos_info else {})
                    c_text = rc.get("comment_text", "").strip()
                    if c_text:
                        formatted.append({
                            "video_id": v_match.get("video_id", "video"),
                            "video_url": v_match.get("video_url", f"https://www.youtube.com/watch?v={v_match.get('video_id', '')}"),
                            "video_title": v_match.get("title", "YouTube Video"),
                            "channel_title": v_match.get("channel_title"),
                            "thumbnail_url": v_match.get("thumbnail_url"),
                            "comment_text": c_text,
                            "user_prompt": prompt,
                            "analysis_sources": v_match.get("analysis_source", "metadata_only"),
                            "language": _norm_lang(rc.get("language") or language),
                            "publication_status": "Draft",
                            "provider": "ollama",
                            "model": settings.OLLAMA_MODEL
                        })
                if formatted:
                    return {
                        "comments": formatted,
                        "analysis_summary": analysis_summary or "Analyzed video details with Ollama (qwen2.5:7b)."
                    }
            except Exception as e:
                logger.debug(f"JSON parsing error from model: {e}")

        # Text Fallback Parsing: Split response by paragraphs/quotes/numbered lists
        lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
        extracted_texts = []
        for line in lines:
            # Match quotes: "..." or 1. ... or - ...
            quote_m = re.search(r'"([^"]{10,})"', line)
            if quote_m:
                extracted_texts.append(quote_m.group(1))
            elif re.match(r'^(?:\d+[\.\)]|\-|\*)\s+(.{15,})', line):
                clean_line = re.sub(r'^(?:\d+[\.\)]|\-|\*)\s+', '', line).strip('"\' ')
                extracted_texts.append(clean_line)

        if not extracted_texts and len(raw_text.strip()) > 10:
            extracted_texts = [raw_text.strip().strip('"')]

        formatted = []
        for i, text in enumerate(extracted_texts[:4]):
            v_match = videos_info[min(i, len(videos_info) - 1)] if videos_info else {}
            formatted.append({
                "video_id": v_match.get("video_id", "video"),
                "video_url": v_match.get("video_url", f"https://www.youtube.com/watch?v={v_match.get('video_id', '')}"),
                "video_title": v_match.get("title", "YouTube Video"),
                "channel_title": v_match.get("channel_title"),
                "thumbnail_url": v_match.get("thumbnail_url"),
                "comment_text": text,
                "user_prompt": prompt,
                "analysis_sources": v_match.get("analysis_source", "metadata_only"),
                "language": "hi" if ("hindi" in language.lower() or language.lower() == "hi") else ("hinglish" if "hinglish" in language.lower() else "en"),
                "publication_status": "Draft",
                "provider": "ollama",
                "model": settings.OLLAMA_MODEL
            })

        return {
            "comments": formatted,
            "analysis_summary": "Extracted comments generated by Ollama (qwen2.5:7b)."
        }

    async def generate_comments(
        self,
        videos_info: List[Dict],
        prompt: str,
        language: str = "English",
        tone: str = "natural",
        max_words: int = 50,
        alternatives_count: int = 1
    ) -> Dict:
        """
        Generates comments using the active AI Provider:
        - Ollama (Local qwen2.5:7b)
        - OpenAI (GPT models)
        - Demo Mode (Smart rule-based generator)
        """
        # Determine actual provider
        provider = settings.AI_PROVIDER.lower()

        # Build accurate source notes
        source_explanations = []
        for v in videos_info:
            if v.get("has_transcript"):
                source_explanations.append(f"'{v.get('title')}' (Transcript & Metadata available)")
            else:
                source_explanations.append(f"'{v.get('title')}' (Transcript unavailable; metadata only)")

        # 1. Ollama Provider
        if provider == "ollama":
            videos_context = []
            for v in videos_info:
                src_label = "Transcript and Metadata" if v.get("has_transcript") else "Title and Description metadata only (Transcripts unavailable)"
                v_ctx = {
                    "video_id": v.get("video_id"),
                    "title": v.get("title"),
                    "channel_title": v.get("channel_title"),
                    "analysis_source": src_label,
                    "description_excerpt": (v.get("description") or "")[:400],
                    "transcript_excerpt": (v.get("transcript_snippet") or "Transcripts/captions could not be accessed.")[:1000]
                }
                videos_context.append(v_ctx)

            user_instruction = f"""
USER INSTRUCTION: {prompt}
TARGET LANGUAGE: {language}
TARGET TONE: {tone}
MAX WORD COUNT PER COMMENT: {max_words} words
NUMBER OF ALTERNATIVES PER VIDEO: {alternatives_count}

VIDEOS TO ANALYZE:
{json.dumps(videos_context, indent=2)}

IMPORTANT:
- If transcript was unavailable, explicitly acknowledge this in analysis_summary and do not pretend you saw specific visual frames.
- Return ONLY a valid JSON object matching this schema:
{{
  "analysis_summary": "Brief note on what content was analyzed for each video and transcript availability",
  "comments": [
    {{
      "video_id": "video_id_here",
      "comment_text": "Your natural comment here",
      "language": "{language.lower()}"
    }}
  ]
}}
"""
            try:
                raw_response = await self._call_ollama_chat(
                    prompt=user_instruction,
                    system_prompt=SYSTEM_PROMPT
                )
                parsed = self._extract_json_or_fallback(raw_response, videos_info, prompt, language)
                
                # Build transparent summary
                summary = parsed.get("analysis_summary")
                if not summary or len(summary) < 5:
                    summary = f"Generated via local Ollama ({settings.OLLAMA_MODEL}). Analysis sources: {', '.join(source_explanations)}."

                return {
                    "comments": parsed["comments"],
                    "analysis_summary": summary,
                    "mode": "ollama",
                    "model": settings.OLLAMA_MODEL
                }

            except Exception as e:
                err_msg = str(e)
                logger.error(f"Ollama generation failed: {err_msg}")
                # Do not silently use mock responses when Ollama was chosen!
                raise RuntimeError(
                    f"Ollama generation failed: {err_msg}. Please check that Ollama is running at {settings.OLLAMA_BASE_URL}."
                )

        # 2. OpenAI Provider
        elif provider == "openai" and settings.has_openai:
            client = self._get_openai_client()
            if client:
                try:
                    videos_context = []
                    for v in videos_info:
                        src_label = "Transcript and Metadata" if v.get("has_transcript") else "Metadata only"
                        v_ctx = {
                            "video_id": v.get("video_id"),
                            "title": v.get("title"),
                            "channel_title": v.get("channel_title"),
                            "analysis_source": src_label,
                            "description_excerpt": (v.get("description") or "")[:400],
                            "transcript_excerpt": (v.get("transcript_snippet") or "Transcripts unavailable")[:1000]
                        }
                        videos_context.append(v_ctx)

                    user_instruction = f"""
USER INSTRUCTION: {prompt}
TARGET LANGUAGE: {language}
TARGET TONE: {tone}
MAX WORD COUNT PER COMMENT: {max_words} words
NUMBER OF ALTERNATIVES PER VIDEO: {alternatives_count}

VIDEOS TO ANALYZE:
{json.dumps(videos_context, indent=2)}

Please return a valid JSON object strictly matching this schema:
{{
  "analysis_summary": "Brief note on what content was analyzed",
  "comments": [
    {{
      "video_id": "...",
      "comment_text": "...",
      "language": "en" | "hi" | "hinglish"
    }}
  ]
}}
"""
                    response = client.chat.completions.create(
                        model=settings.OPENAI_MODEL,
                        response_format={"type": "json_object"},
                        messages=[
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": user_instruction}
                        ],
                        temperature=0.7,
                        max_tokens=1500
                    )
                    content = response.choices[0].message.content
                    parsed = json.loads(content)
                    raw_comments = parsed.get("comments", [])
                    analysis_summary = parsed.get("analysis_summary", "Analyzed available video details via OpenAI.")

                    result_comments = []
                    for rc in raw_comments:
                        v_match = next((v for v in videos_info if v.get("video_id") == rc.get("video_id")), videos_info[0] if videos_info else {})
                        result_comments.append({
                            "video_id": rc.get("video_id", v_match.get("video_id")),
                            "video_url": f"https://www.youtube.com/watch?v={rc.get('video_id', v_match.get('video_id'))}",
                            "video_title": v_match.get("title", "YouTube Video"),
                            "channel_title": v_match.get("channel_title"),
                            "thumbnail_url": v_match.get("thumbnail_url"),
                            "comment_text": rc.get("comment_text", "").strip(),
                            "user_prompt": prompt,
                            "analysis_sources": v_match.get("analysis_source", "metadata_only"),
                            "language": rc.get("language", language.lower()),
                            "publication_status": "Draft",
                            "provider": "openai",
                            "model": settings.OPENAI_MODEL
                        })

                    return {
                        "comments": result_comments,
                        "analysis_summary": analysis_summary,
                        "mode": "openai",
                        "model": settings.OPENAI_MODEL
                    }
                except Exception as e:
                    logger.error(f"OpenAI error: {e}")
                    raise RuntimeError(f"OpenAI generation failed: {str(e)}")

        # 3. Explicit Demo Mode Fallback
        return self._smart_fallback_generate(videos_info, prompt, language, tone, max_words, alternatives_count)

    def _smart_fallback_generate(
        self,
        videos_info: List[Dict],
        prompt: str,
        language: str = "English",
        tone: str = "natural",
        max_words: int = 50,
        alternatives_count: int = 1
    ) -> Dict:
        """
        Rule and template based generator for Demo Mode.
        Clearly tagged with mode='demo' to distinguish from real local/cloud models.
        """
        comments = []
        lower_prompt = prompt.lower()
        is_hindi = "hindi" in lower_prompt or language.lower() == "hindi"
        is_hinglish = "hinglish" in lower_prompt or language.lower() == "hinglish"
        is_short = "short" in lower_prompt or max_words <= 25
        is_spiritual = "spiritual" in lower_prompt or "spirit" in tone.lower()
        is_art = "art" in lower_prompt or "painting" in lower_prompt or "design" in lower_prompt

        for v in videos_info:
            vid = v.get("video_id", "demo_vid")
            v_title = v.get("title", "this insightful video")
            v_channel = v.get("channel_title", "Creator")
            analysis_src = v.get("analysis_source", "metadata_only")

            for i in range(max(1, alternatives_count)):
                if is_hindi:
                    if is_art:
                        comment_text = f"कला और रचनात्मकता की यह प्रस्तुति सचमुच अद्भुत है! {v_channel} द्वारा बहुत सुंदर और प्रेरणादायक काम। ✨"
                    elif is_spiritual:
                        comment_text = f"मन को शांति और आत्मिक सुकून देने वाला विचारपूर्ण वीडियो। {v_channel} का बहुत-बहुत धन्यवाद। 🙏"
                    elif is_short:
                        comment_text = f"बहुत ही उम्दा और प्रभावशाली प्रस्तुति! बेहतरीन काम {v_channel}। 👏"
                    else:
                        comment_text = f"'{v_title}' में जिस स्पष्टता और सादगी से विषय को प्रस्तुत किया गया है, वह दिल को छू गया। बहुत खूब!"
                    lang_code = "hi"

                elif is_hinglish:
                    if is_art:
                        comment_text = f"Sach mein kya kamaal ka creative execution hai! Har frame aur detail dekhne layak hai, brilliant work {v_channel} bhai. 👌"
                    elif is_spiritual:
                        comment_text = f"Bahut hi shanti aur positive vibes mili is video se. Dil ko sukoon dene wali presentation! 🙏"
                    elif is_short:
                        comment_text = f"Ekdum shaandar video aur solid points! Keep rocking {v_channel}. 🔥"
                    else:
                        comment_text = f"'{v_title}' ka presentation style aur depth wakayi lajawab hai. Aise valuable content banate rahiye!"
                    lang_code = "hinglish"

                else:
                    if is_art:
                        comment_text = f"The artistic attention to detail and creative execution here is truly inspiring! Remarkable craftsmanship by {v_channel}. 🎨"
                    elif is_spiritual:
                        comment_text = f"Such a grounding and deeply reflective presentation. Brought immense calm and meaningful perspective today. 🙏"
                    elif is_short:
                        comment_text = f"Insightful and concise breakdown of '{v_title}'. Great job {v_channel}! 👏"
                    else:
                        comment_text = f"Really appreciated the thoughtful structure in '{v_title}'. The explanation from {v_channel} made this both engaging and easy to follow."
                    lang_code = "en"

                if i == 1:
                    if is_hinglish:
                        comment_text = f"Superb content by {v_channel}! Har point bilkul clear aur engaging tha."
                    elif is_hindi:
                        comment_text = f"विषय की इतनी सुंदर और स्पष्ट व्याख्या बहुत कम देखने को मिलती है। साधुवाद!"
                    else:
                        comment_text = f"Fantastic delivery and pacing. Kudos to {v_channel} for putting together such high quality content!"
                elif i == 2:
                    if is_hinglish:
                        comment_text = f"Quality of production aur content dono top notch hain. Subscribed for more such gems!"
                    elif is_hindi:
                        comment_text = f"शानदार प्रस्तुति और ज्ञानवर्धक जानकारी। आगे भी ऐसे वीडियो की प्रतीक्षा रहेगी।"
                    else:
                        comment_text = f"The depth and perspective shared in this video are top-tier. Subscribed for more!"

                words = comment_text.split()
                if len(words) > max_words:
                    comment_text = " ".join(words[:max_words]) + "..."

                comments.append({
                    "video_id": vid,
                    "video_url": f"https://www.youtube.com/watch?v={vid}",
                    "video_title": v_title,
                    "channel_title": v_channel,
                    "thumbnail_url": v.get("thumbnail_url"),
                    "comment_text": comment_text,
                    "user_prompt": prompt,
                    "analysis_sources": analysis_src,
                    "language": lang_code,
                    "publication_status": "Draft",
                    "provider": "demo",
                    "model": "demo-generator"
                })

        summary = f"[Demo Mode Response] Generated {len(comments)} simulated comment(s) using video metadata. Switch AI Provider to Ollama or OpenAI for live AI."
        return {
            "comments": comments,
            "analysis_summary": summary,
            "mode": "demo",
            "model": "demo-generator"
        }

    async def chat_conversation(
        self,
        messages_history: List[Dict],
        new_prompt: str,
        videos_info: List[Dict],
        language_preference: str = "English"
    ) -> Dict:
        """
        Handles interactive conversational turns with Ollama, OpenAI, or Demo Mode.
        """
        provider = settings.AI_PROVIDER.lower()

        # Build transparent caption note
        missing_captions = [v.get("title") for v in videos_info if not v.get("has_transcript")]
        caption_warning = ""
        if missing_captions:
            caption_warning = f" (Note: Captions/transcript unavailable for {', '.join(missing_captions)}; analysis relied on title and description metadata.)"

        # 1. Ollama Provider
        if provider == "ollama":
            v_details = []
            for v in videos_info:
                v_details.append({
                    "video_id": v.get("video_id"),
                    "title": v.get("title"),
                    "channel": v.get("channel_title"),
                    "source": "transcript_and_metadata" if v.get("has_transcript") else "metadata_only (no captions)",
                    "transcript_sample": (v.get("transcript_snippet") or "Captions unavailable")[:800]
                })

            full_prompt = f"""
CONVERSATION CONTEXT:
User instruction: {new_prompt}
Language preference: {language_preference}

ATTACHED VIDEOS:
{json.dumps(v_details, indent=2)}

INSTRUCTIONS:
Maintain continuity with the user.
Generate 1 to 3 relevant comment variations adhering to the user's instructions.
Output a JSON response with:
1. 'reply': A conversational explanation of what you analyzed and generated{caption_warning}.
2. 'comments': An array of objects with 'video_id', 'comment_text', and 'language'.
"""
            try:
                raw_response = await self._call_ollama_chat(
                    prompt=full_prompt,
                    system_prompt=SYSTEM_PROMPT
                )
                parsed = self._extract_json_or_fallback(raw_response, videos_info, new_prompt, language_preference)
                
                reply_text = f"I've processed your instructions using local Ollama ({settings.OLLAMA_MODEL}) and generated {len(parsed['comments'])} comment(s)."
                if caption_warning:
                    reply_text += caption_warning
                elif any(v.get("has_transcript") for v in videos_info):
                    reply_text += " Video transcripts and metadata were analyzed."

                return {
                    "reply": reply_text,
                    "comments": parsed["comments"],
                    "is_demo": False,
                    "provider": "ollama",
                    "model": settings.OLLAMA_MODEL
                }

            except Exception as e:
                logger.error(f"Ollama chat error: {e}")
                raise RuntimeError(
                    f"Ollama chat error: {str(e)}. Please check that Ollama is running at {settings.OLLAMA_BASE_URL}."
                )

        # 2. OpenAI Provider
        elif provider == "openai" and settings.has_openai:
            client = self._get_openai_client()
            if client:
                try:
                    system_instruction = SYSTEM_PROMPT + "\nMaintain conversational continuity. Provide an updated JSON block containing 'reply' and 'comments'."
                    openai_messages = [{"role": "system", "content": system_instruction}]
                    for m in messages_history[-6:]:
                        openai_messages.append({"role": m["role"], "content": m["content"]})

                    v_details = [{"video_id": v.get("video_id"), "title": v.get("title"), "channel": v.get("channel_title"), "source": v.get("analysis_source")} for v in videos_info]
                    augmented_prompt = f"{new_prompt}\nAttached Videos: {json.dumps(v_details)}\nReturn JSON with keys 'reply' (conversational explanation) and 'comments'."

                    openai_messages.append({"role": "user", "content": augmented_prompt})

                    res = client.chat.completions.create(
                        model=settings.OPENAI_MODEL,
                        response_format={"type": "json_object"},
                        messages=openai_messages,
                        temperature=0.7
                    )
                    parsed = json.loads(res.choices[0].message.content)
                    reply = parsed.get("reply", "Here are your updated comments based on your request.")
                    raw_comments = parsed.get("comments", [])

                    formatted_comments = []
                    for rc in raw_comments:
                        vid = rc.get("video_id") or (videos_info[0]["video_id"] if videos_info else "demo")
                        v_match = next((v for v in videos_info if v.get("video_id") == vid), videos_info[0] if videos_info else {})
                        formatted_comments.append({
                            "video_id": vid,
                            "video_url": f"https://www.youtube.com/watch?v={vid}",
                            "video_title": v_match.get("title", "YouTube Video"),
                            "channel_title": v_match.get("channel_title"),
                            "thumbnail_url": v_match.get("thumbnail_url"),
                            "comment_text": rc.get("comment_text", "").strip(),
                            "user_prompt": new_prompt,
                            "analysis_sources": v_match.get("analysis_source", "metadata_only"),
                            "language": rc.get("language", "en"),
                            "publication_status": "Draft"
                        })

                    return {
                        "reply": reply + caption_warning,
                        "comments": formatted_comments,
                        "is_demo": False,
                        "provider": "openai",
                        "model": settings.OPENAI_MODEL
                    }
                except Exception as e:
                    logger.error(f"OpenAI error: {e}")
                    raise RuntimeError(f"OpenAI chat error: {str(e)}")

        # 3. Demo Mode Fallback
        gen_result = self._smart_fallback_generate(videos_info, new_prompt, language_preference)
        comments = gen_result["comments"]
        reply_text = f"[Demo Mode] Generated {len(comments)} simulated comment(s) matching your prompt."
        if caption_warning:
            reply_text += caption_warning
        else:
            reply_text += " Video metadata was analyzed (demo generation active)."

        return {
            "reply": reply_text,
            "comments": comments,
            "is_demo": True,
            "provider": "demo",
            "model": "demo-generator"
        }

ai_service = AIService()
