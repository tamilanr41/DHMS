# Eclipse Temurin OpenJDK 21 on Alpine Linux for lightweight production
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Add non-root user for cloud security
RUN addgroup -S zhanx && adduser -S zhanx -G zhanx

# Copy the fat executable Spring Boot jar
COPY target/dental-backend-1.0.0.jar app.jar

RUN chown -R zhanx:zhanx /app
USER zhanx

EXPOSE 4000

ENV PORT=4000
ENV JAVA_OPTS="-Xms256m -Xmx1024m -XX:+UseG1GC"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
