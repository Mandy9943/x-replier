#!/bin/bash

# Detener el contenedor actual si está en ejecución
sudo docker stop x-replier || true
sudo docker rm x-replier || true

# Construir la nueva imagen
sudo docker build -t x-replier:latest .

# Ejecutar el nuevo contenedor con reinicio automático
sudo docker run -d --restart=always --name=x-replier \
  --env-file .env \
  -v "$(pwd)/lastChecked.json:/app/lastChecked.json" \
  x-replier:latest

echo "X-Replier actualizado y reiniciado correctamente."
echo "El contenedor se iniciará automáticamente cuando arranque el sistema."
echo "Puedes ver los logs con: npm run docker:logs" 