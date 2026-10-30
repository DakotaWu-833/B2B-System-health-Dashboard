FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S dashboard && adduser -S dashboard -G dashboard
COPY --from=build /app/target/*.jar app.jar
USER dashboard
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
