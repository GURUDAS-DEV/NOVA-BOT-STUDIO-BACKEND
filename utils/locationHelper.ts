interface LocationData {
  country: string;
  region: string;
  city: string;
  timezone: string;
  latitude: number;
  longitude: number;
  isp: string;
}

interface IPApiResponse {
  status: string;
  country: string;
  region: string;
  city: string;
  timezone: string;
  lat: number;
  lon: number;
  org: string;
}

/**
 * Fetch location data from IP address using ip-api.com
 * Free tier: 45 requests/minute, no API key required
 */
export const getLocationFromIP = async (ip: string): Promise<LocationData> => {
  try {
    // Skip private/localhost IPs
    if (isPrivateIP(ip)) {
      return getDefaultLocation("Private Network");
    }

    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,region,city,timezone,lat,lon,org`,
      {
        method: "GET",
        headers: {
          "User-Agent": "Nova-Bot-Studio/1.0",
        },
      }
    );

    if (!response.ok) {
      console.warn(`IP API returned status ${response.status}`);
      return getDefaultLocation("Unknown");
    }

    const data: IPApiResponse = await response.json();

    if (data.status !== "success") {
      console.warn(`IP API error: ${data.status}`);
      return getDefaultLocation("Unknown");
    }

    return {
      country: data.country || "Unknown",
      region: data.region || "Unknown",
      city: data.city || "Unknown",
      timezone: data.timezone || "Unknown",
      latitude: data.lat || 0,
      longitude: data.lon || 0,
      isp: data.org || "Unknown",
    };
  } catch (error) {
    console.error("Error fetching location from IP:", error);
    return getDefaultLocation("Unknown");
  }
};

/**
 * Format location data into readable string
 */
export const formatLocation = (location: LocationData): string => {
  const parts = [];
  
  if (location.city && location.city !== "Unknown") {
    parts.push(location.city);
  }
  
  if (location.region && location.region !== "Unknown") {
    parts.push(location.region);
  }
  
  if (location.country && location.country !== "Unknown") {
    parts.push(location.country);
  }

  if (parts.length === 0) {
    return "Unknown Location";
  }

  return parts.join(", ");
};

/**
 * Extract browser name from User-Agent string
 */
export const getBrowserFromUserAgent = (userAgent: string): string => {
  if (!userAgent) return "Unknown";

  // Chrome
  if (userAgent.includes("Chrome") && !userAgent.includes("Chromium")) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    return match ? `Chrome ${match[1]}` : "Chrome";
  }

  // Firefox
  if (userAgent.includes("Firefox")) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    return match ? `Firefox ${match[1]}` : "Firefox";
  }

  // Safari
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    const match = userAgent.match(/Version\/(\d+)/);
    return match ? `Safari ${match[1]}` : "Safari";
  }

  // Edge
  if (userAgent.includes("Edg")) {
    const match = userAgent.match(/Edg\/(\d+)/);
    return match ? `Edge ${match[1]}` : "Edge";
  }

  // Opera
  if (userAgent.includes("OPR")) {
    const match = userAgent.match(/OPR\/(\d+)/);
    return match ? `Opera ${match[1]}` : "Opera";
  }

  return "Unknown Browser";
};

/**
 * Extract device/OS from User-Agent string
 */
export const getDeviceFromUserAgent = (userAgent: string): string => {
  if (!userAgent) return "Unknown";

  // Windows
  if (userAgent.includes("Windows NT 10.0")) return "Windows 10";
  if (userAgent.includes("Windows NT 6.3")) return "Windows 8.1";
  if (userAgent.includes("Windows NT 6.2")) return "Windows 8";
  if (userAgent.includes("Windows")) return "Windows";

  // macOS
  if (userAgent.includes("Macintosh")) {
    if (userAgent.includes("Intel")) return "macOS (Intel)";
    if (userAgent.includes("PPC")) return "macOS (PowerPC)";
    return "macOS";
  }

  // Linux
  if (userAgent.includes("Linux")) {
    if (userAgent.includes("Android")) return "Android";
    if (userAgent.includes("Ubuntu")) return "Ubuntu";
    return "Linux";
  }

  // iOS
  if (userAgent.includes("iPhone")) return "iPhone";
  if (userAgent.includes("iPad")) return "iPad";
  if (userAgent.includes("iPod")) return "iPod";

  return "Unknown Device";
};

/**
 * Check if IP is private/local
 */
function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^127\./, // Loopback
    /^10\./, // Private range 10.0.0.0 - 10.255.255.255
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private range 172.16.0.0 - 172.31.255.255
    /^192\.168\./, // Private range 192.168.0.0 - 192.168.255.255
    /^::1$/, // IPv6 loopback
    /^fc00:/, // IPv6 private
    /^fe80:/, // IPv6 link-local
  ];

  return privateRanges.some((range) => range.test(ip));
}

/**
 * Get default location object
 */
function getDefaultLocation(city: string): LocationData {
  return {
    country: "Unknown",
    region: "Unknown",
    city,
    timezone: "Unknown",
    latitude: 0,
    longitude: 0,
    isp: "Unknown",
  };
}
