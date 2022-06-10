import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { Tab1PageModule } from './../tab1/tab1.module';
import { Tab2PageModule } from './../tab2/tab2.module';
import { Tab3PageModule } from './../tab3/tab3.module';
import { TabsPage } from './tabs.page';
import { TabsPageRoutingModule } from './tabs-routing.module';

@NgModule({
    imports: [IonicModule, CommonModule, FormsModule, TabsPageRoutingModule, Tab1PageModule, Tab2PageModule, Tab3PageModule],
    declarations: [TabsPage],
})
export class TabsPageModule {}
