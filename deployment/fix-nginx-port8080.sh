#!/bin/bash
# JobsitePro sur port 8080 quand Docker occupe le port 80
# Usage: sudo bash deployment/fix-nginx-port8080.sh

set -e
SERVER_IP="${SERVER_IP:-127.0.0.1}"
HTTP_PORT="${HTTP_PORT:-8080}"
PB_PORT="${PB_PORT:-8090}"
PUSH_PORT="${PUSH_PORT:-3099}"
OCR_PORT="${OCR_PORT:-3101}"

[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }

if ss -tlnp | grep -q ":$HTTP_PORT "; then
  echo "Port $HTTP_PORT déjà utilisé — choisissez HTTP_PORT=8888 par ex."
  ss -tlnp | grep ":$HTTP_PORT " || true
  exit 1
fi

cat > /etc/nginx/sites-available/chantiertrack << EOF
server {
    listen $HTTP_PORT default_server;
    listen [::]:$HTTP_PORT default_server;
    server_name $SERVER_IP _;

    client_max_body_size 50M;

    location /push/ {
        proxy_pass http://127.0.0.1:$PUSH_PORT/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /ocr/ {
        proxy_pass http://127.0.0.1:$OCR_PORT/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        client_max_body_size 20M;
    }

    location / {
        proxy_pass http://127.0.0.1:$PB_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

ln -sf /etc/nginx/sites-available/chantiertrack /etc/nginx/sites-enabled/chantiertrack
nginx -t
systemctl start nginx || systemctl restart nginx

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Docker garde le port 80 — JobsitePro sur le port $HTTP_PORT"
echo "══════════════════════════════════════════════════════════"
echo "  Patron   : http://$SERVER_IP:$HTTP_PORT/patron/"
echo "  Employé  : http://$SERVER_IP:$HTTP_PORT/employe/"
echo "  Admin PB : http://$SERVER_IP:$HTTP_PORT/_/"
echo "  OCR test : http://$SERVER_IP:$HTTP_PORT/ocr/health"
echo ""
echo "  Dans l'app (patron + employé), URL API :"
echo "    http://$SERVER_IP:$HTTP_PORT"
echo "  (sans :8090)"
echo "══════════════════════════════════════════════════════════"
