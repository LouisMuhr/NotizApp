import { weekdayLabel, WEEKDAY_ORDER } from '../src/models/Note';
import de from '../src/i18n/locales/de';
import en from '../src/i18n/locales/en';

// Expo-Wochentag: 1=Sonntag … 7=Samstag. Die Label-Arrays beginnen bei Sonntag = Index 0.
test.each([
  [1, 'Sonntag'], [2, 'Montag'], [3, 'Dienstag'], [4, 'Mittwoch'], [5, 'Donnerstag'], [6, 'Freitag'], [7, 'Samstag'],
])('Expo-Wochentag %i → %s', (wd, name) => {
  expect(weekdayLabel(de.editor.weekdays, wd)).toBe(name);
});

test('Kurzlabels: Donnerstag (5) ist Do, nicht Fr', () => {
  expect(weekdayLabel(de.editor.weekdaysShort, 5)).toBe('Do');
  expect(weekdayLabel(en.editor.weekdaysShort, 2)).toBe('Mo');
});

test('Label passt zum echten Wochentag des Datums (Date.getDay()+1 = Expo)', () => {
  const thursday = new Date(2026, 9, 1); // 1.10.2026
  expect(weekdayLabel(de.editor.weekdays, thursday.getDay() + 1)).toBe('Donnerstag');
});

test('WEEKDAY_ORDER: Montag zuerst, Sonntag zuletzt', () => {
  expect(WEEKDAY_ORDER.map((wd) => weekdayLabel(de.editor.weekdaysShort, wd))).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
});
