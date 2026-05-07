import type { Library, LibraryHours, UserCoordinate } from '../types';

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

export function getLibraryStatus(library: Library, now: Date) {
  const day = now.getDay();
  const hours = getHoursForDay(library, day);

  if (isClosedByRule(library.closedRules, now)) {
    return {
      isOpen: false,
      label: '오늘 휴관',
      tone: 'closed' as const,
    };
  }

  if (!hours) {
    return {
      isOpen: false,
      label: '오늘 휴관',
      tone: 'closed' as const,
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = toMinutes(hours.open);
  const closeMinutes = toMinutes(hours.close);

  if (currentMinutes < openMinutes) {
    return {
      isOpen: false,
      label: `${hours.open} 개관`,
      tone: 'soon' as const,
    };
  }

  if (currentMinutes > closeMinutes) {
    return {
      isOpen: false,
      label: '오늘 운영 종료',
      tone: 'closed' as const,
    };
  }

  return {
    isOpen: true,
    label: `운영 중 · ${hours.close}까지`,
    tone: 'open' as const,
  };
}

export function hasWeekendHours(library: Library) {
  return Boolean(library.saturdayHours || library.sundayHours);
}

export function getDistanceKm(from: UserCoordinate, library: Library) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(library.latitude - from.latitude);
  const dLon = toRadians(library.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(library.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

export function formatDistance(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }

  return `${distanceKm.toFixed(1)}km`;
}

function getHoursForDay(library: Library, day: number): LibraryHours | null {
  if (day === 0) {
    return library.sundayHours;
  }

  if (day === 6) {
    return library.saturdayHours;
  }

  return library.weekdayHours;
}

function isClosedByRule(rules: string[], date: Date) {
  const todayName = DAY_NAMES[date.getDay()];
  const weekOfMonth = Math.ceil(date.getDate() / 7);

  return rules.some((rule) => {
    if (rule.includes('매주') && rule.includes(todayName)) {
      return true;
    }

    if (rule.includes(todayName)) {
      if (rule.includes('첫째') && weekOfMonth === 1) {
        return true;
      }

      if (rule.includes('둘째') && weekOfMonth === 2) {
        return true;
      }

      if (rule.includes('셋째') && weekOfMonth === 3) {
        return true;
      }

      if (rule.includes('넷째') && weekOfMonth === 4) {
        return true;
      }
    }

    return false;
  });
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);

  return hours * 60 + minutes;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
