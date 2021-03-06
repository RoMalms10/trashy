#!/usr/bin/python3
"""
Flask App that handles API requests and redirects
"""
from datetime import datetime
from flask import Flask, render_template, url_for, redirect, session
from flask import jsonify, request
from flask_login import LoginManager, login_required, login_user, \
    logout_user, current_user
from models import storage, classes
from requests_oauthlib import OAuth2Session
from requests.exceptions import HTTPError
import json

# Flask setup
app = Flask(__name__)
app.url_map.strict_slashes = False
app.config.update(SECRET_KEY=classes['Auth'].SECRET_KEY)
login_manager = LoginManager(app)
login_manager.login_view = "login"
login_manager.session_protection = "strong"
port = 5000
host = '0.0.0.0'

# Serve html files
@app.route('/')
def landing_page():
    """
    Render the landing page
    """
    if current_user.is_authenticated:
        return redirect(url_for('render_map_page'))
    else:
        return render_template('index.html')

@app.route('/map')
@login_required
def render_map_page():
    """
    Serve the map webpage
    """
    return render_template('map.html')

@app.route('/about')
def about_page():
    """
    Serves the About page
    """
    return render_template('about.html')

@app.route('/to_map')
def to_map():
    """
    From the About page, brings the user back to index if they aren't logged in
    and will bring back to map if they are logged in
    """
    if current_user.is_authenticated:
        return redirect(url_for('render_map_page'))
    else:
        return redirect(url_for('landing_page'))

# Handling Errors
@app.errorhandler(404)
def page_not_found(e):
    """
    Returns the custom 404 page
    """
    return render_template('404.html'), 404

@app.errorhandler(500)
def page_not_found(e):
    """
    Returns the custom 500 page
    """
    return render_template('500.html'), 500

# API Backend
@app.route('/api/bins')
def get_bins():
    """
    Gets all of the bin info from csv file
    """
    trash_list = []
    obj_dict = storage.all()
    for key, value in obj_dict.items():
        trash_list.append(value.to_dict())
    return jsonify(trash_list)

@app.route('/api/bins/proximity', methods=['POST'])
def proximity_bins():
    """
    Get closest trash cans to user
    returns a dict
    """
    radius = .02
    post_info = request.get_json()
    if "latitude" not in post_info or "longitude" not in post_info:
        return jsonify({"status": "error"})
    prox_list = storage.proximity(post_info["latitude"], post_info["longitude"], radius)
    i = 2
    while (len(prox_list) != 20 and i < 1000):
        prox_list = storage.proximity(post_info["latitude"], post_info["longitude"], radius*i)
        i = i + 1
    if (i == 1000 and len(prox_list) == 0):
        return jsonify({"status": "nothing found"})
    for dicts in prox_list:
        if current_user.is_authenticated:
            if dicts["user_id"] != current_user.id:
                dicts.pop("user_id", None)
        else:
            dicts.pop("user_id", None)
    return jsonify(prox_list)

@app.route('/add', methods=["POST"])
def add_marker():
    """
    Takes in a POST request to create a new marker from a signed in user
    Returns the object itself that was created
    """
    if not current_user.is_authenticated:
        return json.dumps({"status": "error"})
    post_info = request.get_json()
    if len(post_info) != 2:
        return jsonify({"status": "error"})
    if "latitude" not in post_info or "longitude" not in post_info:
        return jsonify({"status": "error"})
    # most_recent is a list with 1 dict in it containing the most recent submit
    most_recent = storage.get_user_submitted(current_user.id)
    if len(most_recent) > 0:
        time_format = "%Y-%m-%d %H:%M:%S.%f"
        recent = datetime.strptime(most_recent[0]["created_at"], time_format)
        # Get current time to check if a submit has been made recently
        present = datetime.utcnow()
        # Subtract the two times
        mins_since_submit = present-recent
        if (mins_since_submit.total_seconds() / 60) < 1:
            return jsonify({"status": "time"})
    check_db = storage.get("Marker", post_info["latitude"], post_info["longitude"])
    # If a value is returned, there is already a marker there
    if check_db is None:
        new_marker = classes["Marker"]()
        new_marker.latitude = post_info["latitude"]
        new_marker.longitude = post_info["longitude"]
        new_marker.user_id = current_user.id
        new_marker.save()
        return jsonify(new_marker.to_dict())
    else:
        return jsonify({"status": "duplicate"})

@app.route('/delete', methods=["POST"])
def delete_marker():
    """
    Takes a POST request with latitude and longitude to delete from DB
    Returns {"status": ok} on success
    """
    if not current_user.is_authenticated:
        return json.dumps({"status": "error"})
    delete_info = request.get_json()
    if len(delete_info) != 2:
        return json.dumps({"status": "error"})
    if "latitude" not in delete_info or "longitude" not in delete_info:
        return json.dumps({"status": "error"})
    # Gets the object to delete
    marker_delete = storage.get("Marker", delete_info["latitude"], delete_info["longitude"])
    if marker_delete:
        marker_delete.delete()
        return json.dumps({"status": "ok"})
    else:
        return json.dumps({"status": "error"})

# Google OAuth
@login_manager.user_loader
def load_user(user_id):
    """
    Grabs the user based off the user_id passed
    """
    return storage.g_auth_user_id("User", user_id)

def get_google_auth(state=None, token=None):
    if token:
        return OAuth2Session(classes["Auth"].CLIENT_ID, token=token)
    if state:
        return OAuth2Session(
            classes["Auth"].CLIENT_ID,
            state=state,
            redirect_uri=classes["Auth"].REDIRECT_URI)
    oauth = OAuth2Session(
        classes["Auth"].CLIENT_ID,
        redirect_uri=classes["Auth"].REDIRECT_URI,
        scope=classes["Auth"].SCOPE)
    return oauth

@app.route('/login')
def login():
    if current_user.is_authenticated:
        return redirect(url_for('render_map_page'))
    google = get_google_auth()
    auth_url, state = google.authorization_url(
        classes["Auth"].AUTH_URI, access_type='offline')
    session['oauth_state'] = state
    return redirect(auth_url)

@app.route('/gCallback')
def callback():
    if current_user is not None and current_user.is_authenticated:
        return redirect(url_for('render_map_page'))
    if 'error' in request.args:
        if request.args.get('error') == 'access_denied':
            return 'You denied access.'
        return 'Error encountered.'
    if 'code' not in request.args and 'state' not in request.args:
        return redirect(url_for('render_map_page'))
    else:
        google = get_google_auth(state=session['oauth_state'])
        try:
            token = google.fetch_token(
                classes["Auth"].TOKEN_URI,
                client_secret=classes["Auth"].CLIENT_SECRET,
                authorization_response=request.url)
        except HTTPError:
            return 'HTTPError occurred.'
        google = get_google_auth(token=token)
        resp = google.get(classes["Auth"].USER_INFO)
        if resp.status_code == 200:
            user_data = resp.json()
            email = user_data['email']
            user = storage.g_auth_user("User", email)
            if user is None:
                user = classes["User"]()
                user.email = email
                user.name = user_data['name']
                user.tokens = json.dumps(token)
                user.save()
            else:
                user.name = user_data['name']
                user.tokens = json.dumps(token)
                storage.save()
            login_user(user)
            return redirect(url_for('render_map_page'))
        return 'Could not fetch your information.'

@app.route('/logout')
#@login_required
def logout():
    logout_user()
    storage.save()
    return redirect(url_for('landing_page'))

if __name__ == "__main__":
    app.run(host=host, port=port)
