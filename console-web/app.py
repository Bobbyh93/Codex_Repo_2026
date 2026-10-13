"""Pipeline Console web app: serves the console behind a password and proxies
a fixed set of read views plus the two insert-only console functions."""
import datetime
import decimal
import hmac
import os
import secrets
import time

import psycopg
from flask import Flask, abort, jsonify, redirect, request, send_from_directory, session
from psycopg.rows import dict_row

VIEWS = {'status', 'today', 'manuscripts', 'activity', 'decisions', 'criteria', 'files', 'runs',
         'inbox', 'rules', 'backlog', 'process', 'vocabulary', 'sources'}

app = Flask(__name__, static_folder=None)
# One gunicorn worker: without SECRET_KEY set, sign-ins last until the next restart.
app.secret_key = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Lax',
                  SESSION_COOKIE_SECURE=os.environ.get('INSECURE_COOKIES') != '1',
                  PERMANENT_SESSION_LIFETIME=datetime.timedelta(days=30))
STATIC = os.path.join(os.path.dirname(__file__), 'static')

LOGIN = """<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pipeline Console</title>
<body style="font:16px system-ui;background:#f5f6f8;margin:0;display:grid;place-items:center;min-height:100vh">
<form method="post" style="background:#fff;border:1px solid #e2e5ea;border-radius:14px;padding:24px;width:min(320px,90vw)">
<h1 style="font-size:20px;margin:0 0 16px">Pipeline Console</h1>
<input id="pw" name="password" type="password" placeholder="Password" autofocus autocomplete="current-password"
 style="width:100%;box-sizing:border-box;min-height:44px;font:inherit;padding:0 12px;border:1px solid #c9cfd8;border-radius:10px">
<button style="width:100%;min-height:44px;margin-top:12px;font:inherit;font-weight:600;color:#fff;background:#1f4fd1;border:0;border-radius:10px">Sign in</button>
__MSG__</form>"""


def authed():
    return session.get('ok') is True


def need_api():
    if not authed():
        abort(401)
    if request.headers.get('X-Requested-With') != 'console':
        abort(403)


def conv(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat()
    if isinstance(v, decimal.Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    return v


def query(sql, params=()):
    with psycopg.connect(os.environ['DATABASE_URL'], row_factory=dict_row) as conn:
        rows = conn.execute(sql, params).fetchall()
    return [{k: conv(v) for k, v in r.items()} for r in rows]


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        pw = os.environ.get('CONSOLE_PASSWORD')
        if not pw:
            return LOGIN.replace('__MSG__', '<p style="color:#a8231a;margin:12px 0 0">Not set up yet: CONSOLE_PASSWORD is missing.</p>'), 503
        if hmac.compare_digest(request.form.get('password', '').encode(), pw.encode()):
            session.permanent = True
            session['ok'] = True
            return redirect('/')
        time.sleep(1.5)
        return LOGIN.replace('__MSG__', '<p style="color:#a8231a;margin:12px 0 0">Wrong password.</p>'), 401
    return LOGIN.replace('__MSG__', '')


@app.get('/')
def index():
    if not authed():
        return redirect('/login')
    return send_from_directory(STATIC, 'index.html')


@app.get('/api/ping')
def ping():
    need_api()
    return jsonify(ok=True)


@app.get('/api/view/<name>')
def view(name):
    need_api()
    if name not in VIEWS:
        abort(404)
    return jsonify(rows=query('SELECT * FROM pp.v_console_' + name))


@app.post('/api/queue_run')
def queue_run():
    need_api()
    b = request.get_json(force=True)
    try:
        rows = query('SELECT pp.console_queue_run(%s::uuid, %s, %s) AS msg_id', (b['req'], b.get('ms'), b.get('note') or None))
    except psycopg.Error as e:
        return jsonify(error=str(e).splitlines()[0]), 400
    return jsonify(rows=rows)


@app.post('/api/record_decision')
def record_decision():
    need_api()
    b = request.get_json(force=True)
    try:
        rows = query('SELECT pp.console_record_decision(%s::uuid, %s, %s, %s, %s, %s::uuid, %s::int) AS decision_id',
                     (b['req'], b.get('ms') or None, b.get('question') or None, b.get('answer') or None,
                      b.get('note') or None, b.get('id') or None, b.get('ord')))
    except psycopg.Error as e:
        return jsonify(error=str(e).splitlines()[0]), 400
    return jsonify(rows=rows)
