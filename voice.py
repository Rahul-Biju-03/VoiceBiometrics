from flask import Flask, render_template, request, jsonify, url_for, redirect, session
import os
import pickle
import shutil
import sys
import numpy as np
import scipy.io.wavfile
from sklearn.mixture import GaussianMixture
from pydub import AudioSegment
from io import BytesIO
from fuzzywuzzy import fuzz
from speech_recognition import Recognizer, AudioFile
from random_words import RandomWords
from python_speech_features import mfcc
from sklearn import preprocessing
import json
from threading import Lock

app = Flask(__name__)
app.secret_key = os.urandom(24)
app.config['SESSION_TYPE'] = 'filesystem'

PORT = 8080
COMMON_PHRASE = "My voice is my password, verify me."
USER_DIR = "Users"
MODEL_DIR = "Models"
RECOGNIZER = Recognizer()

# Simple username-password store
# In production, use a database or secure password storage mechanism
user_credentials = {
    "test_user": "test_password"  # Example entry
}

# Global variables
username = ""
filename_wav = ""


credentials_lock = Lock()

CREDENTIALS_FILE = 'user_credentials.jsonl'

def save_credentials():
    with credentials_lock:
        with open(CREDENTIALS_FILE, 'w') as f:
            for username, password in user_credentials.items():
                json.dump({username: password}, f)
                f.write('\n')

def load_credentials():
    global user_credentials
    user_credentials = {}
    if os.path.exists(CREDENTIALS_FILE):
        with credentials_lock:
            with open(CREDENTIALS_FILE, 'r') as f:
                for line in f:
                    credentials = json.loads(line.strip())
                    user_credentials.update(credentials)


@app.route('/')
@app.route('/home')
def home():
    print("Rendering home page")
    return render_template('main.html')


@app.route('/enroll', methods=["GET", "POST"])
def enroll():
    global username

    if request.method == 'POST':
        data = request.get_json()
        username = data['username']
        password = data['password']
        repassword = data['repassword']
        print(f"Received enrollment request for username: {username}")

        if password != repassword:
            print("Passwords do not match")
            return jsonify("Passwords do not match"), 400

        session['username'] = username

        user_directory = os.path.join(USER_DIR, username)
        if not os.path.exists(user_directory):
            os.makedirs(user_directory)
            print(f"Created user directory: {user_directory}")
        else:
            shutil.rmtree(user_directory, ignore_errors=False, onerror=None)
            os.makedirs(user_directory)
            print(f"Cleared and recreated user directory: {user_directory}")

        # Store the username and password in the user_credentials dictionary
        user_credentials[username] = password
        save_credentials()  # Save credentials to file
        print(f"Stored credentials for user: {username}")

        session['action'] = 'enroll'
        return redirect(url_for('voice'))
    else:
        print("Rendering enrollment page")
        return render_template('enroll.html')



@app.route('/auth', methods=['POST', 'GET'])
def auth():
    global username

    if request.method == 'POST':
        data = request.get_json()
        username = data['username']
        password = data['password']
        is_password_auth = data['isPasswordAuth']
        print(f"Received authentication request for username: {username}")

        session['username'] = username

        user_exists = username in user_credentials

        if user_exists:
            if is_password_auth:
                # Validate the password
                if user_credentials[username] == password:
                    session['auth_result'] = 'success'
                    print("Password authentication successful")
                    return jsonify("Authenticated")
                else:
                    session['auth_result'] = 'fail'
                    print("Invalid password")
                    return jsonify("Invalid password"), 401
            else:
                session['action'] = 'auth'
                print("Voice authentication requested")
                return jsonify("Exists")
        else:
            print("User does not exist")
            return jsonify("Doesn't exist"), 404
    else:
        print("Rendering authentication page")
        return render_template('auth.html')


@app.route('/voice', methods=['GET', 'POST'])
def voice():
    global filename_wav

    if request.method == 'POST':
        if 'file' not in request.files:
            print("No file part in request")
            return "fail"
        file = request.files['file']
        if file.filename == '':
            print("No selected file")
            return "fail"
        if file:
            user_dir_path = os.path.join(USER_DIR, session['username'])
            os.makedirs(user_dir_path, exist_ok=True)
            filename_wav = os.path.join(user_dir_path, "common_phrase.wav")
            print(f"Saving uploaded file to: {filename_wav}")

            audio = AudioSegment.from_file(BytesIO(file.read()))
            audio.export(filename_wav, format="wav")
            file_size = os.path.getsize(filename_wav)
            if file_size == 0:
                print("File size is zero after saving")
                return "fail"

            recognised_words = speech_to_text_recognition(filename_wav)
            print(f"Recognised words: {recognised_words}")

            if fuzz.ratio(COMMON_PHRASE.lower().strip(), recognised_words) < 25:
                os.remove(filename_wav)
                print("Recognised words do not match common phrase")
                return "fail"
            else:
                if session.get('action') == 'enroll':
                    session['enroll_result'] = 'success'
                    print("Enrollment action recognized, redirecting to biometrics")
                    return redirect(url_for('biometrics'))
                elif session.get('action') == 'auth':
                    session['auth_result'] = 'success'
                    print("Authentication action recognized, redirecting to verify")
                    return redirect(url_for('verify'))
    print("Rendering voice page")
    return render_template('voice.html', common_phrase=COMMON_PHRASE)


@app.route('/verify', methods=['GET'])
def verify():
    global username
    global filename_wav

    print(f"Verifying user: {username} with file: {filename_wav}")
    (rate, signal) = scipy.io.wavfile.read(filename_wav)
    extracted_features = extract_features(rate, signal)

    gmm_models = [os.path.join(MODEL_DIR, user) for user in os.listdir(MODEL_DIR) if user.endswith('.gmm')]

    models = []
    for user in gmm_models:
        with open(user, 'rb') as model_file:
            try:
                sys.modules['sklearn.mixture.gaussian_mixture'] = sys.modules['sklearn.mixture._gaussian_mixture']
                models.append(pickle.load(model_file))
                print(f"Loaded model: {user}")
            except Exception as e:
                print(f"[ERROR] Failed to load model {user}: {e}")
                continue

    user_list = [os.path.splitext(os.path.basename(user))[0] for user in gmm_models]
    log_likelihood = np.zeros(len(models))

    for i in range(len(models)):
        gmm = models[i]
        scores = np.array(gmm.score(extracted_features))
        log_likelihood[i] = scores.sum()

    print("Log likelihood:", log_likelihood)
    
    identified_user = np.argmax(log_likelihood)
    identified_username = user_list[identified_user]
    print(f"Identified user: {identified_username}")

    if identified_username == username:
        session['auth_result'] = 'success'
        print("User verification successful")
    else:
        session['auth_result'] = 'fail'
        print("User verification failed")

    return redirect(url_for('auth_result'))


@app.route('/biometrics', methods=['GET', 'POST'])
def biometrics():
    global username

    user_directory = os.path.join(USER_DIR, username)
    features = np.asarray(())

    print(f"Extracting features for user: {username}")
    for file in os.listdir(user_directory):
        filename_wav = os.fsdecode(file)
        if filename_wav.endswith(".wav"):
            (rate, signal) = scipy.io.wavfile.read(os.path.join(user_directory, filename_wav))
            extracted_features = extract_features(rate, signal)
            if features.size == 0:
                features = extracted_features
            else:
                features = np.vstack((features, extracted_features))

    gmm = GaussianMixture(n_components=16, max_iter=200, covariance_type='diag', n_init=3)
    gmm.fit(features)
    pickle.dump(gmm, open(os.path.join(MODEL_DIR, f"{username}.gmm"), "wb"), protocol=None)
    features = np.asarray(())
    print(f"Saved GMM model for user: {username}")

    session['enroll_result'] = 'success'
    return redirect(url_for('enroll_result'))


@app.route('/enroll_result')
def enroll_result():
    print(f"Rendering enrollment result page for user: {session.get('username')}")
    return render_template('enroll_result.html', username=session.get('username'), enroll_result=session.get('enroll_result'))


@app.route('/auth_result')
def auth_result():
    print(f"Rendering authentication result page for user: {session.get('username')}")
    return render_template('auth_result.html', result=session.get('auth_result'), username=session.get('username'))


def speech_to_text_recognition(wav_file):
    print(f"Performing speech-to-text recognition on file: {wav_file}")
    with AudioFile(wav_file) as source:
        audio = RECOGNIZER.record(source)
    try:
        recognized_text = RECOGNIZER.recognize_google(audio)
    except:
        recognized_text = ""
    print(f"Recognized text: {recognized_text}")
    return recognized_text


def calculate_delta(array):
    rows, cols = array.shape
    deltas = np.zeros((rows, 20))
    N = 2
    for i in range(rows):
        index = []
        j = 1
        while j <= N:
            if i - j < 0:
                first = 0
            else:
                first = i - j
            if i + j > rows - 1:
                second = rows - 1
            else:
                second = i + j
            index.append((second, first))
            j += 1
        deltas[i] = (array[index[0][0]] - array[index[0][1]] + (2 * (array[index[1][0]] - array[index[1][1]]))) / 10
    return deltas


def extract_features(rate, signal):
    print(f"Extracting features from signal with rate: {rate}")
    mfcc_feat = mfcc(signal, rate, winlen=0.020, preemph=0.95, numcep=20, nfft=1024, ceplifter=15, highfreq=6000, nfilt=55, appendEnergy=False)
    mfcc_feat = preprocessing.scale(mfcc_feat)
    delta_feat = calculate_delta(mfcc_feat)
    combined_features = np.hstack((mfcc_feat, delta_feat))
    return combined_features


if __name__ == '__main__':
    print(f"Starting Flask app on port {PORT}")
    load_credentials()
    app.run(host='0.0.0.0', port=PORT, debug=True)

