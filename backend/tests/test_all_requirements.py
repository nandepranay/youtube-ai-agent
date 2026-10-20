import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.config import settings
from app.database.connection import Base, get_db

from app.models.models import Account, VideoQueueItem, CommentRecord
from app.utils.url_helpers import extract_video_id, validate_youtube_url, extract_all_youtube_urls_from_text
from app.utils.security import (
    encrypt_token,
    decrypt_token,
    generate_oauth_state,
    verify_oauth_state,
    check_and_record_duplicate_attempt
)

from sqlalchemy.pool import StaticPool

# Test SQLite in-memory database with StaticPool so all connections share the same memory DB
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

# 1. Test YouTube URL Validation & ID Extraction
def test_youtube_url_validation_and_id_extraction():
    valid_cases = [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ]
    for url, expected_id in valid_cases:
        vid = extract_video_id(url)
        assert vid == expected_id, f"Failed for {url}"
        is_valid, extracted_id, norm_url = validate_youtube_url(url)
        assert is_valid is True
        assert extracted_id == expected_id
        assert "youtube.com/watch?v=dQw4w9WgXcQ" in norm_url

    invalid_cases = [
        "https://vimeo.com/123456",
        "https://google.com",
        "random string not a link",
        "",
        None
    ]
    for url in invalid_cases:
        assert extract_video_id(url) is None
        is_valid, vid, _ = validate_youtube_url(url)
        assert is_valid is False

def test_extract_all_urls_from_text():
    sample_text = "Check out this video https://youtu.be/dQw4w9WgXcQ and also https://www.youtube.com/watch?v=9bZkp7q19f0 please!"
    urls = extract_all_youtube_urls_from_text(sample_text)
    assert len(urls) == 2
    assert "dQw4w9WgXcQ" in urls[0]
    assert "9bZkp7q19f0" in urls[1]

# 2. Test Token Encryption and Security
def test_token_encryption_and_decryption():
    secret = "my_super_secret_oauth_token_12345"
    cipher = encrypt_token(secret)
    assert cipher != secret
    decrypted = decrypt_token(cipher)
    assert decrypted == secret

# 3. Test OAuth State Validation & Account Isolation
def test_oauth_state_generation_and_validation():
    # Valid slot 1
    state = generate_oauth_state(1)
    slot = verify_oauth_state(state)
    assert slot == 1

    # Valid slot 4
    state4 = generate_oauth_state(4)
    slot4 = verify_oauth_state(state4)
    assert slot4 == 4

    # Tampered state
    tampered = state + "bad"
    assert verify_oauth_state(tampered) is None

    # Invalid slot (e.g., slot 5)
    state5 = generate_oauth_state(5)
    assert verify_oauth_state(state5) is None

# 4. Test Missing Credentials & Health Endpoint
def test_health_endpoint_and_missing_credentials(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "demo_mode" in data
    assert "connected_accounts_count" in data

# 5. Test AI Comment Generation with Mocked / Smart Fallback Generator
def test_ai_comment_generation(client):
    payload = {
        "video_urls": ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
        "prompt": "Write a respectful comment appreciating the visual art and music in Hindi",
        "language": "Hindi",
        "tone": "respectful",
        "max_words": 30,
        "alternatives_count": 2
    }
    res = client.post("/api/comments/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["comments"]) >= 2
    first_c = data["comments"][0]
    assert first_c["video_id"] == "dQw4w9WgXcQ"
    assert first_c["language"] == "hi"
    assert len(first_c["comment_text"]) > 5

# 6. Test Explicit User Approval Requirement for Publishing
def test_publishing_requires_explicit_approval(client):
    # Attempt publication without explicit approval -> must fail
    payload = {
        "video_id": "dQw4w9WgXcQ",
        "comment_text": "Awesome video!",
        "account_slot": 1,
        "explicit_approval": False
    }
    res = client.post("/api/comments/publish", json=payload)
    assert res.status_code == 400
    assert "Explicit approval is required" in res.json()["detail"]

# 7. Test Duplicate Submission Protection
def test_duplicate_submission_protection():
    vid = "test_vid_123"
    comment = "Great tutorial on FastAPI!"
    # First attempt should pass
    is_dup1 = check_and_record_duplicate_attempt(vid, comment, cooldown_seconds=10)
    assert is_dup1 is False
    # Second immediate attempt must be blocked
    is_dup2 = check_and_record_duplicate_attempt(vid, comment, cooldown_seconds=10)
    assert is_dup2 is True

# 8. Test Account Isolation & Publishing Authorization with Disconnected Account
def test_publishing_with_unconnected_account(client, db_session):
    # Slot 3 is not connected
    payload = {
        "video_id": "dQw4w9WgXcQ",
        "comment_text": "Insightful commentary!",
        "account_slot": 3,
        "explicit_approval": True
    }
    res = client.post("/api/comments/publish", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert data["publication_status"] == "Failed"
    assert "Account slot 3 is not connected" in data["error"]

# 9. Test Video Queue Management
def test_video_queue_lifecycle(client):
    # Add to queue
    add_payload = {"video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "selected_account_slot": 1}
    add_res = client.post("/api/queue", json=add_payload)
    assert add_res.status_code == 200
    item = add_res.json()
    assert item["video_id"] == "dQw4w9WgXcQ"
    item_id = item["id"]

    # List queue
    list_res = client.get("/api/queue")
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(i["id"] == item_id for i in items)

    # Delete from queue
    del_res = client.delete(f"/api/queue/{item_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Verify deleted
    list_res_after = client.get("/api/queue")
    assert not any(i["id"] == item_id for i in list_res_after.json())

# 10. Test Comment History & Filtering
def test_comment_history_and_filtering(client, db_session):
    # Insert two records
    rec1 = CommentRecord(
        video_id="vid1",
        video_url="https://youtube.com/watch?v=vid1",
        video_title="FastAPI Mastery Guide",
        channel_title="Python Devs",
        comment_text="Loved the dependency injection chapter!",
        user_prompt="Appreciate video",
        publication_status="Published",
        account_slot=1
    )
    rec2 = CommentRecord(
        video_id="vid2",
        video_url="https://youtube.com/watch?v=vid2",
        video_title="React 19 Deep Dive",
        channel_title="Frontend Pros",
        comment_text="Great explanation of server components",
        user_prompt="Summarize video",
        publication_status="Draft",
        account_slot=2
    )
    db_session.add_all([rec1, rec2])
    db_session.commit()

    # Query all
    all_res = client.get("/api/comments/history")
    assert all_res.status_code == 200
    assert len(all_res.json()) >= 2

    # Query by status
    draft_res = client.get("/api/comments/history?status=Draft")
    assert all(c["publication_status"] == "Draft" for c in draft_res.json())

    # Query by search
    search_res = client.get("/api/comments/history?search=FastAPI")
    assert len(search_res.json()) == 1
    assert "FastAPI" in search_res.json()[0]["video_title"]

# 11. Test YouTube API Failure Handling
@pytest.mark.asyncio
async def test_youtube_api_failure_handling(client, db_session):
    from app.services.comment_service import comment_service
    # Mock account in slot 2
    acc = Account(
        slot=2,
        email="creator@test.com",
        display_name="Creator Test",
        encrypted_access_token=encrypt_token("mock_token"),
        encrypted_refresh_token=encrypt_token("mock_refresh"),
        is_connected=True,
        is_demo=False
    )
    db_session.add(acc)
    db_session.commit()

    from unittest.mock import PropertyMock
    with patch("app.services.youtube_service.youtube_service.publish_comment") as mock_pub:
        # Simulate comments disabled error from YouTube Data API
        mock_pub.return_value = {
            "success": False,
            "status": "Failed",
            "error": "Comments are disabled on this YouTube video."
        }

        # Mock settings.is_demo_mode = False and has_google_oauth = True for this test
        with patch.object(type(settings), "is_demo_mode", new_callable=PropertyMock, return_value=False), \
             patch.object(type(settings), "has_google_oauth", new_callable=PropertyMock, return_value=True):
            res = await comment_service.publish_approved_comment(
                db=db_session,
                comment_id=None,
                video_id="dQw4w9WgXcQ",
                comment_text="Test comment text",
                account_slot=2,
                explicit_approval=True
            )

            assert res["success"] is False
            assert res["publication_status"] == "Failed"
            assert "Comments are disabled" in res["error"]
            # Verify draft was preserved in database
            saved_draft = db_session.query(CommentRecord).filter(CommentRecord.video_id == "dQw4w9WgXcQ").first()
            assert saved_draft is not None
            assert saved_draft.publication_status == "Failed"
            assert "Comments are disabled" in saved_draft.error_message
