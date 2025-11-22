![Banner](https://repository-images.githubusercontent.com/1098981639/3c7e985c-45df-43be-a078-d57ebb82e65e)

# GhostCast

**GhostCast** is a lightweight, low-latency platform for real-time screen sharing. It allows users to stream their desktop screen directly from a terminal-based Python client to a web browser using WebSockets.

The project is built on modern web technologies, ensuring high performance and a fully responsive interface for mobile devices.

![Connect page](https://i.postimg.cc/GtHK1nR8/connect-page.png)

## Key Features

  * **Terminal-Based Streaming:** The client runs via a single Python command, requiring no heavy GUI software installation.
  * **Low Latency:** Utilizes WebSockets and MJPEG protocol for instant frame transmission.
  * **Mobile Adaptation:**
      * Optimized interface for both portrait and landscape orientations.
      * Prevention of system zoom on iOS devices.
      * "Fake Fullscreen" support for iPhone browsers.
  * **Real-time Chat:** Integrated text chat between the streamer and viewers.
  * **Snapshot Capability:** Viewers can instantly save high-quality frames of the stream.
  * **Security:** Full support for HTTPS/WSS, CSRF protection, and room isolation.

![Stream Page](https://i.postimg.cc/1XfBZ1SF/stream-page.png)

## Technology Stack

  * **Backend:** Python 3.13, Django, Django Channels (Daphne), Asyncio.
  * **Frontend:** React, Vite, CSS3 (Flexbox/Grid).
  * **Protocol:** WebSockets.
  * **Deployment:** Nginx (Reverse Proxy), Systemd, Linux (Ubuntu).

-----

## Installation Guide (Production)

This guide assumes deployment on a clean **Ubuntu 22.04/24.04** server.

### Step 1. Server Preparation

Update the system and install necessary packages:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv nginx git certbot python3-certbot-nginx -y
```

### Step 2. Backend Setup

1.  Clone the repository:

    ```bash
    cd /root/
    git clone https://github.com/your-username/ghostcast-server.git
    cd ghostcast-server
    ```

2.  Create a virtual environment and install dependencies:

    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    pip install daphne python-dotenv
    ```

3.  Create the `.env` file:

    ```bash
    nano .env
    ```

    Add the following configuration:

    ```ini
    DEBUG=False
    SECRET_KEY=your_generated_secure_key
    ALLOWED_HOSTS=your.domain.com,localhost,127.0.0.1
    ```

4.  Collect static files and apply migrations:

    ```bash
    python manage.py migrate
    python manage.py collectstatic --noinput
    ```

### Step 3. Frontend Build

1.  Navigate to the frontend directory:

    ```bash
    cd frontend
    ```

2.  Install Node.js (if not already installed) and dependencies:

    ```bash
    # Example for Ubuntu (NodeSource)
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs

    npm install
    ```

3.  Build the project:

    ```bash
    npm run build
    ```

    *This will create the `dist` directory served by Nginx.*

### Step 4. Systemd Configuration (Daphne)

Create a service file to run Django in the background:

```bash
sudo nano /etc/systemd/system/ghostcast.service
```

Insert the following configuration (adjust paths if necessary):

```ini
[Unit]
Description=GhostCast Daphne Service
After=network.target

[Service]
User=root
Group=root
WorkingDirectory=/root/ghostcast-server
Environment="PYTHONPATH=/root/ghostcast-server"
ExecStart=/root/ghostcast-server/venv/bin/daphne -b 127.0.0.1 -p 8001 config.asgi:application
Restart=always

[Install]
WantedBy=multi-user.target
```

Start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ghostcast
sudo systemctl start ghostcast
```

### Step 5. Nginx Configuration

Create the site configuration file:

```bash
sudo nano /etc/nginx/sites-available/ghostcast
```

Insert the following config (replace `your.domain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name your.domain.com;

    access_log /var/log/nginx/ghostcast_access.log;
    error_log /var/log/nginx/ghostcast_error.log;

    # Serve Django static files
    location /static/ {
        alias /root/ghostcast-server/staticfiles/;
    }

    # WebSocket Proxy
    location ~ ^/(ws|admin) {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve Frontend (React)
    location / {
        root /root/ghostcast-server/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

Activate the site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/ghostcast /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6. SSL Setup (HTTPS)

HTTPS is required for WebSockets to function correctly on modern browsers:

```bash
sudo certbot --nginx -d your.domain.com
```

-----

## Client Usage (Streamer)

1.  On the computer you wish to stream from, navigate to the `streamer_client` folder.
2.  Install Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Edit `config.py` to point to your server:
    ```python
    SERVER_URL = "wss://your.domain.com/ws/room/"
    ```
4.  Start the stream:
    ```bash
    python main.py <room_name>
    ```

-----

## License

This project is distributed under the MIT License.