from app.models import all_users

def users():
    return {"users": all_users()}
