import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  // Read the locale from the NEXT_LOCALE cookie
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'es';

  // Load the corresponding messages dictionary
  let messages;
  try {
    messages = (await import(`../messages/${locale}.json`)).default;
  } catch (error) {
    // Fallback to Spanish if the locale dictionary is not found
    messages = (await import(`../messages/es.json`)).default;
  }

  return {
    locale,
    messages
  };
});
