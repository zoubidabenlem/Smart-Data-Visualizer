import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { GlobalErrorHandler } from './app/core/errors/global-error-handler';

const globalErrorHandler = new GlobalErrorHandler();

window.addEventListener('error', (event) => {
  console.error('[Bootstrap] window error', event.error ?? event.message);
  globalErrorHandler.handleError(event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Bootstrap] unhandled rejection', event.reason);
  globalErrorHandler.handleError(event.reason);
});

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => {
    console.error('[Bootstrap] bootstrap failed', err);
    globalErrorHandler.handleError(err);
  });
