import { RouterModule, Routes } from '@angular/router';

import { NgModule } from '@angular/core';
import { Tab1Page } from './../tab1/tab1.page';
import { Tab2Page } from './../tab2/tab2.page';
import { Tab3Page } from './../tab3/tab3.page';
import { TabsPage } from './tabs.page';

const routes: Routes = [
    {
        path: 'tab',
        component: TabsPage,
        children: [
            {
                path: 'tab1',
                component: Tab1Page,
            },
            {
                path: 'tab2',
                component: Tab2Page,
            },
            {
                path: 'tab3',
                component: Tab3Page,
            },
            {
                path: '',
                redirectTo: '/tab/tab1',
                pathMatch: 'full',
            },
        ],
    },
    {
        path: '',
        redirectTo: '/tab/tab1',
        pathMatch: 'full',
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class TabsPageRoutingModule {}
