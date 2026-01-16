#!/bin/bash

domains=(topikgo.com www.topikgo.com)
data_path="./certbot"
email="" # Để trống nếu không muốn nhập email
staging=0 # Đổi thành 1 nếu test (tránh rate limit)

if [ -d "$data_path" ]; then
  read -p "Certificate đã tồn tại. Thay thế? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

echo "### Tạo dummy certificate tạm thời ..."
path="/etc/letsencrypt/live/topikgo.com"
mkdir -p "$data_path/conf/live/topikgo.com"
docker-compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:4096 -days 1 \
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo

echo "### Khởi động nginx ..."
docker-compose up --force-recreate -d nginx
echo

echo "### Xóa dummy certificate ..."
docker-compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/topikgo.com && \
  rm -Rf /etc/letsencrypt/archive/topikgo.com && \
  rm -Rf /etc/letsencrypt/renewal/topikgo.com.conf" certbot
echo

echo "### Request SSL certificate từ Let's Encrypt ..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker-compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size 4096 \
    --agree-tos \
    --force-renewal" certbot
echo

echo "### Reload nginx với SSL certificate mới ..."
docker-compose exec nginx nginx -s reload

echo "### XONG! Truy cập https://topikgo.com để kiểm tra"
