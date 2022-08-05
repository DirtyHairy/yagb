import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { Component, Input, OnInit } from '@angular/core';

export interface GameSettings {
    name: string;
}

@Component({
    selector: 'app-game-settings',
    templateUrl: './game-settings.component.html',
    styleUrls: ['./game-settings.component.scss'],
})
export class GameSettingsComponent implements OnInit {
    constructor() {}

    get formControlName(): AbstractControl {
        return this.formGroup.get('name');
    }

    ngOnInit() {
        this.createFormGroup();
    }

    save(): void {
        if (this.formGroup.invalid) {
            return;
        }

        this.settings.name = this.formControlName.value;

        this.onSave();
    }

    cancel(): void {
        this.onCancel();
    }

    onEnter(): void {
        this.save();
    }

    private createFormGroup(): void {
        this.formGroup = new FormGroup({
            name: new FormControl(this.settings.name, { validators: [Validators.required] }),
        });
    }

    @Input()
    public settings!: GameSettings;

    public formGroup!: FormGroup;

    @Input()
    onSave: () => void = () => undefined;

    @Input()
    onCancel: () => void = () => undefined;
}
