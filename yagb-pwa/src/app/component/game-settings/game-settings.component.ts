import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Component, Input, OnInit } from '@angular/core';

import { GameService } from './../../service/game.service';
import { GameSettings } from 'src/app/model/game-settings';

@Component({
    selector: 'app-game-settings',
    templateUrl: './game-settings.component.html',
    styleUrls: ['./game-settings.component.scss'],
})
export class GameSettingsComponent implements OnInit {
    constructor(private gameService: GameService) {}

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

        this.settings.name = this.formControlName.value.trimRight();

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
            name: new FormControl(this.settings.name, { validators: [Validators.required, this.validateNameUnique] }),
        });
    }

    private validateNameUnique = (control: AbstractControl): ValidationErrors | null =>
        control.value.trimRight() !== this.settings.name && this.gameService.getAllGames().some((g) => g.name === control.value.trimRight())
            ? { name: 'already taken' }
            : null;

    @Input()
    public settings!: GameSettings;

    public formGroup!: FormGroup;

    @Input()
    onSave: () => void = () => undefined;

    @Input()
    onCancel: () => void = () => undefined;
}
