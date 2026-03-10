#backend/Dockerfile
FROM python:3.11-slim

#Syytem dependencies : mysqlclient and pymysql
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc default-libmysqlclient-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

#Working directory
WORKDIR /app

#install python dependancies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

#Copy backed source code
COPY . .

#Create uploads directory (volume)
RUN mkdir -p /app/uploads

#Entrypoint 
#seed DB and start uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]