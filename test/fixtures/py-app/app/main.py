from flask import Flask
from app.views import users

app = Flask(__name__)

@app.route("/users")
def index():
    return users()

if __name__ == "__main__":
    app.run()
