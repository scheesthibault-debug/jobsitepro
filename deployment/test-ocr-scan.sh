#!/bin/bash
# Test scan OCR depuis le serveur (sans téléphone)
# Usage: sudo bash deployment/test-ocr-scan.sh

set -e
OCR="${OCR_URL:-http://127.0.0.1:3101}"
echo "=== Health ==="
curl -s "$OCR/health" | python3 -m json.tool 2>/dev/null || curl -s "$OCR/health"
echo ""

# Mini image JPEG 1x1 (test connexion Gemini — pas un vrai reçu)
B64="/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Cf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//Z"

echo "=== Scan test (sans auth si REQUIRE_AUTH=false) ==="
curl -s -X POST "$OCR/scan-receipt" \
  -H "Content-Type: application/json" \
  -d "{\"imageBase64\":\"data:image/jpeg;base64,$B64\",\"mimeType\":\"image/jpeg\"}" \
  | python3 -m json.tool 2>/dev/null || curl -s -X POST "$OCR/scan-receipt" \
  -H "Content-Type: application/json" \
  -d "{\"imageBase64\":\"data:image/jpeg;base64,$B64\",\"mimeType\":\"image/jpeg\"}"
echo ""
echo "Si erreur Gemini 400/403 → clé API invalide"
echo "Si 401 → POCKETBASE_URL ou token employé"
echo "Pour test sans auth: REQUIRE_AUTH=false dans /opt/chantiertrack/receipt-ocr/.env puis restart"
