# Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/SkySpire.Api/SkySpire.Api.csproj SkySpire.Api/
RUN dotnet restore SkySpire.Api/SkySpire.Api.csproj

COPY src/SkySpire.Api/ SkySpire.Api/
WORKDIR /src/SkySpire.Api
RUN dotnet publish -c Release -o /app/publish --no-restore

# Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Development

COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "SkySpire.Api.dll"]
