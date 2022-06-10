import { RouterModule, Routes } from '@angular/router';

import { AboutPage } from './../page/about/about.page';
import { GamesPage } from '../page/games/games.page';
import { NgModule } from '@angular/core';
import { PlayPage } from '../page/play/play.page';
import { SettingsPage } from '../page/settings/settings.page';
import { TabsPage } from './tabs.page';

const routes: Routes = [
    {
        path: 'tab',
        component: TabsPage,
        children: [
            {
                path: 'play',
                component: PlayPage,
            },
            {
                path: 'games',
                component: GamesPage,
            },
            {
                path: 'settings',
                component: SettingsPage,
            },
            {
                path: 'about',
                component: AboutPage,
            },
            {
                path: '',
                redirectTo: '/tab/games',
                pathMatch: 'full',
            },
        ],
    },
    {
        path: '',
        redirectTo: '/tab/games',
        pathMatch: 'full',
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class TabsPageRoutingModule {}
