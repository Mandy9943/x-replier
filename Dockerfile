FROM node:18-slim

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código fuente
COPY . .

# Comando para ejecutar la aplicación
CMD ["node", "index.js"] 