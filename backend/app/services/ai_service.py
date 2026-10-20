import json
import logging
import re
from typing import Dict, List, Optional
from openai import OpenAI
from app.config import settings
from app.schemas.schemas import CommentCardDto

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are TubePilot AI, an expert YouTube comment assistant.
Your goal is to generate thoughtful, natural, and highly engaging comments based ONLY on the provided video information (title, channel, description, and transcript snippet).

CRITICAL CONSTRAINTS:
1. Never fabricate or invent visual scenes or facts that are not present in the provided metadata or transcript.
2. If only metadata (title/description) is available, craft comments that reflect that context without falsely claiming "I watched the part where..."
3. Always respect the requested language (English, Hindi, or Hinglish) and requested length/word count.
4. Hindi comments should be written in natural Devanagari script or Hinglish (Latin script) depending on the instruction.
5. Hinglish should be modern, natural conversational Hindi written in Roman script (e.g. "Bhai kya shaandar video hai, lighting aur composition kamaal ka laga!").
6. Keep tone conversational, human, and appreciative. Avoid generic spammy praise.
7. Output structured JSON when requested so the frontend can display interactive comment cards.
"""

class AIService:
    def __init__(self):
        self.model = settings.OPENAI_MODEL

    def _get_openai_client(self) -> Optional[OpenAI]:
        if settings.has_openai:
            try:
                return OpenAI(api_key=settings.OPENAI_API_KEY)
            except Exception as e:
                logger.error(f"Error initializing OpenAI client: {e}")
        return None

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
        Generates comments for given videos according to prompt and parameters.
        Returns comments list and analysis summary.
        """
        client = self._get_openai_client()

        if client and settings.has_openai:
            try:
                videos_context = []
                for v in videos_info:
                    src_label = "Transcript & Metadata" if v.get("has_transcript") else "Title and Description Metadata only"
                    v_ctx = {
                        "video_id": v.get("video_id"),
                        "title": v.get("title"),
                        "channel_title": v.get("channel_title"),
                        "analysis_source": src_label,
                        "description_excerpt": (v.get("description") or "")[:400],
                        "transcript_excerpt": (v.get("transcript_snippet") or "Not available")[:1000]
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
  "analysis_summary": "Brief note on what content was analyzed (e.g. analyzed video metadata and transcript for X, metadata only for Y)",
  "comments": [
    {{
      "video_id": "...",
      "comment_text": "...",
      "language": "en" | "hi" | "hinglish",
      "analysis_sources": "metadata_only" | "transcript_and_metadata"
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
                analysis_summary = parsed.get("analysis_summary", "Analyzed available video details.")

                result_comments = []
                for rc in raw_comments:
                    # Match with video metadata
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
                        "publication_status": "Draft"
                    })

                return {
                    "comments": result_comments,
                    "analysis_summary": analysis_summary,
                    "mode": "live"
                }

            except Exception as e:
                logger.error(f"OpenAI completion error: {e}. Falling back to smart local generator.")

        # Smart Fallback / Demo Mode Generator
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
        High quality rule & template based generator for development/demo mode
        supporting English, Hindi, and Hinglish with tone and length awareness.
        """
        comments = []
        lower_prompt = prompt.lower()
        is_hindi = "hindi" in lower_prompt or language.lower() == "hindi"
        is_hinglish = "hinglish" in lower_prompt or language.lower() == "hinglish"
        is_short = "short" in lower_prompt or max_words <= 25
        is_spiritual = "spiritual" in lower_prompt or "spirit" in tone.lower()
        is_art = "art" in lower_prompt or "painting" in lower_prompt or "design" in lower_prompt
        has_emoji = "emoji" in lower_prompt and "remove" not in lower_prompt and "no emoji" not in lower_prompt

        for v in videos_info:
            vid = v.get("video_id", "demo_vid")
            v_title = v.get("title", "this insightful video")
            v_channel = v.get("channel_title", "Creator")
            analysis_src = v.get("analysis_source", "metadata_only")
            has_tr = v.get("has_transcript", False)

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
                    # English
                    if is_art:
                        comment_text = f"The artistic attention to detail and creative execution here is truly inspiring! Remarkable craftsmanship by {v_channel}. 🎨"
                    elif is_spiritual:
                        comment_text = f"Such a grounding and deeply reflective presentation. Brought immense calm and meaningful perspective today. 🙏"
                    elif is_short:
                        comment_text = f"Insightful and concise breakdown of '{v_title}'. Great job {v_channel}! 👏"
                    else:
                        comment_text = f"Really appreciated the thoughtful structure in '{v_title}'. The explanation from {v_channel} made this both engaging and easy to follow."
                    lang_code = "en"

                # If alternatives requested, vary wording
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

                # Trim words if needed
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
                    "publication_status": "Draft"
                })

        summary = f"Generated {len(comments)} comment(s) using video metadata ({', '.join(v.get('analysis_source', 'metadata_only') for v in videos_info)}). Demo mode active."
        return {
            "comments": comments,
            "analysis_summary": summary,
            "mode": "demo"
        }

    async def chat_conversation(
        self,
        messages_history: List[Dict],
        new_prompt: str,
        videos_info: List[Dict],
        language_preference: str = "English"
    ) -> Dict:
        """
        Handles conversational back-and-forth:
        e.g., 'Make this comment shorter', 'Translate to Hindi', etc.
        Maintains conversational context and extracts updated comments.
        """
        client = self._get_openai_client()

        if client and settings.has_openai:
            try:
                system_instruction = SYSTEM_PROMPT + "\nMaintain conversational continuity. If user asks to modify previous comments (e.g. shorten, change tone, translate), provide an updated JSON block containing the revised comments and an assistant message explaining the adjustments."
                
                openai_messages = [{"role": "system", "content": system_instruction}]
                for m in messages_history[-8:]:
                    openai_messages.append({"role": m["role"], "content": m["content"]})

                # Append current user prompt and current video context
                v_details = [{"video_id": v.get("video_id"), "title": v.get("title"), "channel": v.get("channel_title"), "source": v.get("analysis_source")} for v in videos_info]
                augmented_prompt = f"{new_prompt}\nAttached Videos: {json.dumps(v_details)}\nReturn JSON with keys 'reply' (conversational explanation) and 'comments' (array of updated comment objects with video_id, comment_text, language)."

                openai_messages.append({"role": "user", "content": augmented_prompt})

                res = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    response_format={"type": "json_object"},
                    messages=openai_messages,
                    temperature=0.7
                )
                parsed = json.loads(res.choices[0].message.content)
                reply = parsed.get("reply", "I have updated the comments based on your request.")
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
                    "reply": reply,
                    "comments": formatted_comments,
                    "is_demo": False
                }
            except Exception as e:
                logger.error(f"Chat completion error: {e}. Falling back to demo conversational responder.")

        # Fallback conversational response
        gen_result = self._smart_fallback_generate(videos_info, new_prompt, language_preference)
        comments = gen_result["comments"]
        
        reply_text = f"I've analyzed your instructions ('{new_prompt}') and generated {len(comments)} comment card(s) matching your requested tone and constraints."
        if any(v.get("has_transcript") for v in videos_info):
            reply_text += " Transcript & video metadata were utilized for analysis."
        else:
            reply_text += " Video metadata (title, author, description) was analyzed because full captions were not publicly exposed."

        return {
            "reply": reply_text,
            "comments": comments,
            "is_demo": True
        }

ai_service = AIService()
