FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
# Cache dependencies trước (giúp giảm thời gian build lại đáng kể nếu không đổi pom.xml)
RUN chmod +x ./mvnw && ./mvnw dependency:go-offline

COPY src ./src
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:25-jre
WORKDIR /app
# Chỉ cài các module thực sự cần thiết của LibreOffice (bỏ meta-package "libreoffice" nặng nề)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libreoffice-core libreoffice-writer libreoffice-calc fontconfig fonts-dejavu wget \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080

# Giới hạn RAM tối đa của Java xuống 400MB để không bị OOM (Out of Memory) trên Render Free Tier (tối đa 512MB)
ENTRYPOINT ["java", "-Xmx400m", "-Xms200m", "-jar", "app.jar"]
