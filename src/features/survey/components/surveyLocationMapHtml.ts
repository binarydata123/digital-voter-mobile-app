import type { SurveyLocationPoint } from "@/services/survey";

const DEFAULT_CENTER = {
  latitude: 30.80192,
  longitude: 76.8966656,
};

type LeafletLocationPoint = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  details: string[];
};

export function getSurveyLocationMapRegion(locations: SurveyLocationPoint[]) {
  const latitudes = locations.map((location) => location.latitude);
  const longitudes = locations.map((location) => location.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeDelta = Math.max(0.006, (maxLatitude - minLatitude) * 1.28);
  const longitudeDelta = Math.max(0.006, (maxLongitude - minLongitude) * 1.28);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}

function formatLocationTime(capturedAt?: string) {
  if (!capturedAt) return "";
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export function getValidSurveyLocations(locations: SurveyLocationPoint[]) {
  return locations.filter(
    (location) =>
      Number.isFinite(location.latitude) && Number.isFinite(location.longitude),
  );
}

function toLeafletPoint(
  location: SurveyLocationPoint,
  index: number,
): LeafletLocationPoint {
  const title =
    location.location ??
    (location.wardNo ? `Ward ${location.wardNo}` : `Survey ${index + 1}`);
  const preference = location.preferredPolitician
    ? `${location.preferredPolitician}${location.preferredParty ? ` (${location.preferredParty})` : ""}`
    : "";

  return {
    id: location.id ?? `${location.latitude}-${location.longitude}-${index}`,
    latitude: location.latitude,
    longitude: location.longitude,
    title,
    details: [
      location.wardNo && location.location !== location.wardNo
        ? `Ward ${location.wardNo}`
        : "",
      location.boothNo ? `Booth ${location.boothNo}` : "",
      preference,
      formatLocationTime(location.capturedAt),
    ].filter(Boolean),
  };
}

function serializeScriptValue(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildSurveyLocationMapHtml(locations: SurveyLocationPoint[]) {
  const validLocations = getValidSurveyLocations(locations);
  const markerData = validLocations.map(toLeafletPoint);
  const region = validLocations.length
    ? getSurveyLocationMapRegion(validLocations)
    : DEFAULT_CENTER;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map {
        height: 100%;
        margin: 0;
        width: 100%;
      }

      body {
        background: #F8FAFC;
        color: #0F172A;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .leaflet-container {
        background: #E2E8F0;
      }

      .popup-title {
        color: #0F172A;
        font-size: 14px;
        font-weight: 800;
        margin-bottom: 4px;
      }

      .popup-detail {
        color: #475569;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.35;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var markers = ${serializeScriptValue(markerData)};
      var map = L.map("map", {
        attributionControl: false,
        zoomControl: true,
        zoomSnap: 0.1
      }).setView([${region.latitude}, ${region.longitude}], ${markerData.length > 1 ? 11 : 15});

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);

      var markerLayer = L.featureGroup();
      var distinctMarkerLatLngs = [];
      var seenMarkerCoordinates = {};
      var escapeHtml = function (value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      };

      markers.forEach(function (location) {
        var coordinateKey = location.latitude.toFixed(5) + "," + location.longitude.toFixed(5);
        var popupDetails = location.details
          .map(function (detail) {
            return '<div class="popup-detail">' + escapeHtml(detail) + '</div>';
          })
          .join("");
        var popupHtml = '<div class="popup-title">' + escapeHtml(location.title) + '</div>' + popupDetails;

        if (!seenMarkerCoordinates[coordinateKey]) {
          seenMarkerCoordinates[coordinateKey] = true;
          distinctMarkerLatLngs.push([location.latitude, location.longitude]);
        }

        L.marker([location.latitude, location.longitude])
          .bindPopup(popupHtml)
          .addTo(markerLayer);
      });

      markerLayer.addTo(map);

      var fitMapToMarkers = function () {
        map.invalidateSize(false);

        if (distinctMarkerLatLngs.length > 1) {
          var bounds = L.latLngBounds(distinctMarkerLatLngs);
          if (bounds.isValid()) {
            map.fitBounds(bounds, {
              animate: false,
              maxZoom: 16,
              padding: [36, 36]
            });
          }
        } else if (markers.length === 1) {
          map.setView([markers[0].latitude, markers[0].longitude], 15, {
            animate: false
          });
        }
      };

      map.whenReady(function () {
        fitMapToMarkers();
        requestAnimationFrame(fitMapToMarkers);
        setTimeout(fitMapToMarkers, 100);
        setTimeout(fitMapToMarkers, 350);
      });

      if (window.ResizeObserver) {
        new ResizeObserver(fitMapToMarkers).observe(document.getElementById("map"));
      }
    </script>
  </body>
</html>`;
}
