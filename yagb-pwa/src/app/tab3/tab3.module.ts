import { CommonModule } from '@angular/common';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { Tab3Page } from './tab3.page';

@NgModule({
    imports: [IonicModule, CommonModule, FormsModule, ExploreContainerComponentModule],
    declarations: [Tab3Page],
})
export class Tab3PageModule {}
