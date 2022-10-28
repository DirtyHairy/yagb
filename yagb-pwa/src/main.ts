import { AppModule } from './app/app.module';
import { enableProdMode } from '@angular/core';
import { environment } from './environments/environment';
import { hasCurrentGame } from './app/helper/currentGame';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

if (environment.production) {
    enableProdMode();
}

if (hasCurrentGame()) {
    location.replace(`${location.origin}${location.pathname}#/tab/play`);
} else {
    location.replace(`${location.origin}${location.pathname}#/tab/games`);
}

platformBrowserDynamic()
    .bootstrapModule(AppModule)
    .catch((err) => console.log(err));
