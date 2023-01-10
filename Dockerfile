FROM node:latest
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
    
COPY package.json /usr/src/app/
RUN npm install
COPY . /usr/src/app

# TimeZone
ENV TZ=Asia/Bangkok
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
RUN dpkg-reconfigure -f noninteractive tzdata

EXPOSE 8088
CMD ["npm", "start"]