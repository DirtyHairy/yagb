import { AboutPageModule } from './../page/about/about.module';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GamesPageModule } from '../page/games/games.module';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { PlayPageModule } from '../page/play/play.module';
import { SettingsPageModule } from '../page/settings/settings.module';
import { TabsPage } from './tabs.page';
import { TabsPageRoutingModule } from './tabs-routing.module';

@NgModule({
    imports: [IonicModule, CommonModule, FormsModule, TabsPageRoutingModule, PlayPageModule, GamesPageModule, SettingsPageModule, AboutPageModule],
    declarations: [TabsPage],
})
export class TabsPageModule {}
