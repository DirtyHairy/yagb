import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { NgModule } from '@angular/core';
import { TabsPage } from './tabs/tabs.page';
import { TabsPageModule } from './tabs/tabs.module';

const routes: Routes = [
    {
        path: '',
        component: TabsPage,
    },
];
@NgModule({
    imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }), TabsPageModule],
    exports: [RouterModule],
})
export class AppRoutingModule {}
