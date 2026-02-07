/**
 * Cremerie Alijs — Seasonal Theming System
 * Automatically applies seasonal and special day themes based on the current date.
 */

(function () {
  'use strict';

  const THEMES = {
    summer: 'summer',
    winter: 'winter',
    valentines: 'valentines',
    easter: 'easter',
    mothersday: 'mothersday',
    midsummer: 'midsummer',
    national: 'national',
    halloween: 'halloween',
    sinterklaas: 'sinterklaas',
    christmas: 'christmas'
  };

  const TAGLINES = {
    summer: 'Waar elk bolletje een zomerherinnering is',
    winter: 'Waar warmte smelt op je tong',
    valentines: 'Liefde smaakt naar meer — welkom bij onze opening!',
    easter: 'Lente in elk bolletje',
    mothersday: 'Voor de allerliefste',
    midsummer: 'De langste dag, het lekkerste ijs',
    national: 'Trots Belgisch, ambachtelijk lekker',
    halloween: 'Griezelig goed',
    sinterklaas: 'Van de Sint, met liefde gedraaid',
    christmas: 'Maak het feest compleet'
  };

  /**
   * Calculate Easter Sunday for a given year using the Anonymous Gregorian algorithm
   * @param {number} year - The year to calculate Easter for
   * @returns {Date} - Easter Sunday date
   */
  function getEasterDate(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
  }

  /**
   * Get Mother's Day (2nd Sunday of May) for a given year
   * @param {number} year - The year to calculate Mother's Day for
   * @returns {Date} - Mother's Day date
   */
  function getMothersDay(year) {
    const may = new Date(year, 4, 1);
    const dayOfWeek = may.getDay();
    const firstSunday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const secondSunday = firstSunday + 7;
    return new Date(year, 4, secondSunday);
  }

  /**
   * Check if two dates are the same day
   * @param {Date} date1
   * @param {Date} date2
   * @returns {boolean}
   */
  function isSameDay(date1, date2) {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * Check if a date is within a range (inclusive)
   * @param {Date} date - Date to check
   * @param {Date} start - Start of range
   * @param {Date} end - End of range
   * @returns {boolean}
   */
  function isDateInRange(date, start, end) {
    const d = date.getTime();
    return d >= start.getTime() && d <= end.getTime();
  }

  /**
   * Detect the appropriate theme for a given date
   * @param {Date} date - The date to detect theme for
   * @returns {string} - Theme name
   */
  function detectTheme(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // Valentine's Day: February 14
    if (month === 1 && day === 14) {
      return THEMES.valentines;
    }

    // Easter: Saturday through Monday around Easter Sunday
    const easter = getEasterDate(year);
    const easterSaturday = new Date(easter);
    easterSaturday.setDate(easter.getDate() - 1);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    if (isDateInRange(date, easterSaturday, easterMonday)) {
      return THEMES.easter;
    }

    // Mother's Day: 2nd Sunday of May
    const mothersDay = getMothersDay(year);
    if (isSameDay(date, mothersDay)) {
      return THEMES.mothersday;
    }

    // Midsummer: June 21
    if (month === 5 && day === 21) {
      return THEMES.midsummer;
    }

    // Belgian National Day: July 21
    if (month === 6 && day === 21) {
      return THEMES.national;
    }

    // Halloween: October 15 - November 1
    if ((month === 9 && day >= 15) || (month === 10 && day === 1)) {
      return THEMES.halloween;
    }

    // Sinterklaas: December 1-5
    if (month === 11 && day >= 1 && day <= 5) {
      return THEMES.sinterklaas;
    }

    // Christmas: December 6 - January 1
    if ((month === 11 && day >= 6) || (month === 0 && day === 1)) {
      return THEMES.christmas;
    }

    // Summer: April 1 - October 31
    if ((month >= 3 && month <= 9)) {
      return THEMES.summer;
    }

    // Winter: November 1 - March 31
    return THEMES.winter;
  }

  /**
   * Apply a theme to the document
   * @param {string} theme - Theme name to apply
   */
  function applyTheme(theme) {
    if (!Object.values(THEMES).includes(theme)) {
      console.warn(`AlijsTheme: Unknown theme "${theme}", falling back to seasonal detection`);
      theme = detectTheme(new Date());
    }
    document.documentElement.setAttribute('data-theme', theme);

    // Update tagline if element exists
    const taglineEl = document.getElementById('tagline');
    if (taglineEl && TAGLINES[theme]) {
      taglineEl.textContent = TAGLINES[theme];
    }
  }

  /**
   * Get theme from URL parameter
   * @returns {string|null} - Theme name or null if not specified
   */
  function getThemeFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('theme');
  }

  /**
   * Initialize the theme system
   */
  function init() {
    const urlTheme = getThemeFromURL();
    if (urlTheme) {
      applyTheme(urlTheme);
    } else {
      const detectedTheme = detectTheme(new Date());
      applyTheme(detectedTheme);
    }
  }

  // Expose API for debugging
  window.AlijsTheme = {
    THEMES,
    TAGLINES,
    detectTheme,
    applyTheme,
    getEasterDate,
    getMothersDay
  };

  // Initialize on DOM ready or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
