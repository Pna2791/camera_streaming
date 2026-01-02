PRINTERS="192.168.1.25 192.168.1.26"

for ip in $PRINTERS; do
  echo "Uploading to $ip"
  curl -F "file=@Disc_PETG_3m16s.gcode" http://$ip/server/files/upload

  echo "Starting print on $ip"
  curl -X POST -H "Content-Type: application/json" \
       -d '{"filename":"Disc_PETG_3m16s.gcode"}' \
       http://$ip/printer/print/start
done
