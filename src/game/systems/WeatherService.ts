/**
 * Weather service that can fetch real weather or generate random weather.
 */

export type WeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'snow';

export interface WeatherState {
  condition: WeatherCondition;
  temperature: number; // Celsius
  description: string;
  icon: string;
}

const WEATHER_ICONS: Record<WeatherCondition, string> = {
  sunny: '☀️',
  cloudy: '☁️',
  rain: '🌧️',
  snow: '❄️',
};

const WEATHER_DESCRIPTIONS: Record<WeatherCondition, string> = {
  sunny: '晴朗',
  cloudy: '多云',
  rain: '小雨',
  snow: '下雪',
};

// Random weather weights (sunny is most common)
const WEATHER_WEIGHTS: Record<WeatherCondition, number> = {
  sunny: 50,
  cloudy: 30,
  rain: 15,
  snow: 5,
};

/**
 * Generate random weather based on weights.
 */
export function generateRandomWeather(): WeatherState {
  const total = Object.values(WEATHER_WEIGHTS).reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  
  let condition: WeatherCondition = 'sunny';
  for (const [weather, weight] of Object.entries(WEATHER_WEIGHTS)) {
    random -= weight;
    if (random <= 0) {
      condition = weather as WeatherCondition;
      break;
    }
  }
  
  // Temperature based on weather
  let baseTemp = 20;
  switch (condition) {
    case 'sunny': baseTemp = 22 + Math.random() * 8; break;
    case 'cloudy': baseTemp = 18 + Math.random() * 6; break;
    case 'rain': baseTemp = 15 + Math.random() * 5; break;
    case 'snow': baseTemp = -5 + Math.random() * 5; break;
  }
  
  return {
    condition,
    temperature: Math.round(baseTemp),
    description: WEATHER_DESCRIPTIONS[condition],
    icon: WEATHER_ICONS[condition],
  };
}

/**
 * Fetch real weather from wttr.in API.
 * Falls back to random weather on failure.
 */
export async function fetchRealWeather(location: string = 'Beijing'): Promise<WeatherState> {
  try {
    const response = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      console.warn('[weather] API request failed, using random weather');
      return generateRandomWeather();
    }
    
    const data = await response.json();
    const current = data.current_condition?.[0];
    
    if (!current) {
      return generateRandomWeather();
    }
    
    const tempC = parseInt(current.temp_C, 10);
    const weatherCode = parseInt(current.weatherCode, 10);
    
    // Map wttr.in weather codes to our conditions
    let condition: WeatherCondition = 'sunny';
    if (weatherCode >= 200 && weatherCode < 300) {
      condition = 'rain'; // Thunderstorm
    } else if (weatherCode >= 300 && weatherCode < 400) {
      condition = 'rain'; // Drizzle
    } else if (weatherCode >= 500 && weatherCode < 600) {
      condition = 'rain'; // Rain
    } else if (weatherCode >= 600 && weatherCode < 700) {
      condition = 'snow'; // Snow
    } else if (weatherCode >= 700 && weatherCode < 800) {
      condition = 'cloudy'; // Atmosphere (fog, mist)
    } else if (weatherCode === 800) {
      condition = 'sunny'; // Clear
    } else if (weatherCode > 800) {
      condition = 'cloudy'; // Clouds
    }
    
    return {
      condition,
      temperature: tempC,
      description: current.weatherDesc?.[0]?.value || WEATHER_DESCRIPTIONS[condition],
      icon: WEATHER_ICONS[condition],
    };
  } catch (err) {
    console.warn('[weather] Failed to fetch real weather:', err);
    return generateRandomWeather();
  }
}

/**
 * Get weather icon for a condition.
 */
export function getWeatherIcon(condition: WeatherCondition): string {
  return WEATHER_ICONS[condition];
}
