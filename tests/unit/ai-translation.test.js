import { describe, expect, it } from 'vitest';

describe('AI translation logic', () => {
  const translations = [
    { content_type: 'announcement', content_id: 1, language: 'pt', field: 'title', translated_text: 'Bem-vindo!' },
    {
      content_type: 'announcement',
      content_id: 1,
      language: 'pt',
      field: 'body',
      translated_text: 'Estamos felizes...',
    },
    { content_type: 'announcement', content_id: 1, language: 'es', field: 'title', translated_text: '¡Bienvenido!' },
    { content_type: 'event', content_id: 5, language: 'pt', field: 'title', translated_text: 'Churrasco' },
  ];

  function findTranslation(translations, contentType, contentId, language, field) {
    return (
      translations.find(
        (t) =>
          t.content_type === contentType && t.content_id === contentId && t.language === language && t.field === field,
      )?.translated_text || null
    );
  }

  function getTranslatedFields(translations, contentType, contentId, language) {
    return translations
      .filter((t) => t.content_type === contentType && t.content_id === contentId && t.language === language)
      .reduce((acc, t) => {
        acc[t.field] = t.translated_text;
        return acc;
      }, {});
  }

  it('finds translation for specific content+language+field', () => {
    const result = findTranslation(translations, 'announcement', 1, 'pt', 'title');
    expect(result).toBe('Bem-vindo!');
  });

  it('returns null when translation missing', () => {
    const result = findTranslation(translations, 'announcement', 1, 'fr', 'title');
    expect(result).toBeNull();
  });

  it('returns null for wrong content type', () => {
    const result = findTranslation(translations, 'event', 1, 'pt', 'title');
    expect(result).toBeNull();
  });

  it('gets all translated fields for a content item', () => {
    const fields = getTranslatedFields(translations, 'announcement', 1, 'pt');
    expect(fields.title).toBe('Bem-vindo!');
    expect(fields.body).toBe('Estamos felizes...');
  });

  it('handles content with partial translations', () => {
    const fields = getTranslatedFields(translations, 'event', 5, 'pt');
    expect(fields.title).toBe('Churrasco');
    expect(fields.body).toBeUndefined();
  });

  it('returns empty object for untranslated content', () => {
    const fields = getTranslatedFields(translations, 'announcement', 999, 'pt');
    expect(Object.keys(fields).length).toBe(0);
  });

  it('english locale returns null (no translation needed)', () => {
    const result = findTranslation(translations, 'announcement', 1, 'en', 'title');
    expect(result).toBeNull();
  });
});
