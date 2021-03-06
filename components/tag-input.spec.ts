import {
    addProviders,
    fakeAsync,
    TestComponentBuilder,
    ComponentFixture,
    inject,
    tick
} from '@angular/core/testing';

import {
  Component,
  PLATFORM_DIRECTIVES
} from '@angular/core';

import { By } from '@angular/platform-browser';
import { TagInput } from './tag-input';

import {
    Validators,
    FormControl,
    disableDeprecatedForms,
    provideForms,
    REACTIVE_FORM_DIRECTIVES
} from '@angular/forms';

describe('TagInput', () => {
    let builder: TestComponentBuilder;

    beforeEach(() => {
      addProviders([
        disableDeprecatedForms(),
        provideForms(),
        {
            provide: PLATFORM_DIRECTIVES,
            useValue: [REACTIVE_FORM_DIRECTIVES],
            multi: true
        }]
      );
    });

    function getComponent(fixture) {
        tick();
        fixture.detectChanges();
        tick();
        fixture.detectChanges();

        return fixture.debugElement.query(By.directive(TagInput)).componentInstance;
    }

    beforeEach(inject([TestComponentBuilder], (tcb: TestComponentBuilder) => builder = tcb));

    describe('Basic behaviours', () => {
        it('should have 2 tags set by ngModel', fakeAsync(() => {
            const fixture: ComponentFixture<TestApp> = builder.createSync(TestApp);
            const component = getComponent(fixture);

            expect(component.items.length).toEqual(2);
            tick();
        }));

        it('should override the default placeholder of the input', fakeAsync(() => {
            const template = `<tag-input [(ngModel)]="items" placeholder="New Tag"></tag-input>`;
            const fixture: ComponentFixture<TestApp> = builder.overrideTemplate(TestApp, template).createSync(TestApp);
            const component = getComponent(fixture);

            expect(component.items.length).toEqual(2);
            expect(component.input.element.getAttribute('placeholder')).toEqual('New Tag');
        }));
    });

    describe('when a new item is added', () => {
        it('should be added to the list of items and update its parent\'s model', fakeAsync(() => {
            const template = `<tag-input [(ngModel)]="items"></tag-input>`;
            const fixture: ComponentFixture<TestApp> = builder.overrideTemplate(TestApp, template).createSync(TestApp);
            const component = getComponent(fixture);

            component.form.find('item').updateValue('New Item');
            expect(component.form.valid).toEqual(true);

            component.addItem();

            fixture.detectChanges();

            expect(component.form.valid).toEqual(false);
            expect(component.form.controls.item.value).toEqual('');

            fixture.detectChanges();

            expect(fixture.componentInstance.items.length).toEqual(3);
            expect(component.items.length).toEqual(3);
        }));

        it('should not be allowed if max-items is set up', fakeAsync(() => {
            const template = `<tag-input [(ngModel)]="items" [maxItems]="2"></tag-input>`;
            const fixture: ComponentFixture<TestApp> = builder.overrideTemplate(TestApp, template).createSync(TestApp);
            const component = getComponent(fixture);

            component.form.find('item').updateValue('New Item');
            component.addItem();

            fixture.detectChanges();

            expect(fixture.componentInstance.items.length).toEqual(2);
            expect(component.items.length).toEqual(2);
        }));

        it('emits the event onAdd', () => {
            const fixture: ComponentFixture<TestApp> = builder.createSync(TestApp);
            const itemName = 'New Item';

            fakeAsync(() => {
              const component = getComponent(fixture);

              component.form.find('item').updateValue(itemName);

              component.onAdd.subscribe(item => {
                  expect(item).toEqual(itemName);
              });

              component.addItem();
              tick();
            });
        });

        it('does not allow dupes', fakeAsync(() => {
            const fixture: ComponentFixture<TestApp> = builder.createSync(TestApp);
            const component = getComponent(fixture);

            component.form.find('item').updateValue('Javascript');
            component.addItem();
            expect(component.items.length).toEqual(2);
        }));
    });

    describe('when an item is removed', () => {
        it('is removed from the list', fakeAsync(() => {
            const fixture: ComponentFixture<TestApp> = builder.createSync(TestApp);
            const tagName = 'Typescript';
            const component = getComponent(fixture);

            component.removeItem(tagName);

            fixture.detectChanges();

            expect(component.items).toEqual(['Javascript']);
            expect(component.input.isFocused).toEqual(true);

        }));

        it('emits the event onRemove', fakeAsync(() => {
            const fixture: ComponentFixture<TestApp> = builder.createSync(TestApp);
            const component = getComponent(fixture);
            const tagName = 'Typescript';

            component.onRemove.subscribe(item => {
                expect(item).toEqual(tagName);
            });

            component.removeItem(tagName);
            tick();
        }));

        it('is sets current selected item as undefined', fakeAsync(() => {
            const fixture: ComponentFixture<TestApp> = builder.createSync(TestApp);
            const component = getComponent(fixture);
            const tagName = 'Typescript';

            component.removeItem(tagName);
            expect(component.selectedTag).toBe(undefined);
        }));
    });

    describe('testing validators', () => {
        it('injects minLength validator and validates correctly', fakeAsync(() => {
            const template = `<tag-input
                                    [validators]="[validators.minLength]"
                                    [(ngModel)]="items"></tag-input>`;

            const fixture: ComponentFixture<TestApp> = builder.overrideTemplate(TestApp, template).createSync(TestApp);
            const component = getComponent(fixture);

            component.form.find('item').updateValue('Ab');
            expect(component.form.valid).toBe(false);

            component.addItem();
            expect(component.items.length).toEqual(2);


            // addItem element with > 3 chars
            component.form.find('item').updateValue('Abcde');
            expect(component.form.valid).toBe(true);
            component.addItem();

            expect(component.items.length).toEqual(3);
        }));

        it('injects minLength validator and custom validator and validates correctly', fakeAsync(() => {
            const template = `<tag-input
                                    [validators]="[validators.minLength, validators.startsWith]"
                                    [(ngModel)]="items"></tag-input>`;

            const fixture: ComponentFixture<TestApp> = builder.overrideTemplate(TestApp, template).createSync(TestApp);
            const component = getComponent(fixture);

            component.form.find('item').updateValue('Javacript');
            expect(component.form.valid).toBe(false);
            component.addItem();
            expect(component.items.length).toEqual(2);

            component.form.find('item').updateValue('@J');
            expect(component.form.valid).toBe(false);
            component.addItem();
            expect(component.items.length).toEqual(2);


            // addItem element with > 3 chars AND @
            component.form.find('item').updateValue('@Javacript');
            expect(component.form.valid).toBe(true);
            component.addItem();

            expect(component.items.length).toEqual(3);
        }));

        it('validates transformed values', fakeAsync(() => {
            const template = `<tag-input
                                    [transform]="addPrefix"
                                    [validators]="[validators.minLength]"
                                    [(ngModel)]="items">
                             </tag-input>`;

            const fixture: ComponentFixture<TestApp> = builder.overrideTemplate(TestApp, template).createSync(TestApp);
            const component = getComponent(fixture);

            component.form.find('item').updateValue('@');
            component.addItem();

            expect(component.items[2]).toEqual('prefix: @');
            expect(component.items.length).toEqual(3);
        }));
    });

    describe('when user navigates tags with keypress event', () => {
        let keyUp: Event = new Event('keyup');
        let keyDown: Event = new Event('keydown');

        keyDown['keyCode'] = 8;

        it('it handles navigation/deletion of tags', fakeAsync(() => {
            const fixture: ComponentFixture<TestApp> = builder.createSync(TestApp);
            const component = getComponent(fixture);

            component.focus();

            // selected tag is undefined
            expect(component.selectedTag).toEqual(undefined);

            // press backspace
            component.input.element.dispatchEvent(keyDown);

            // selected tag is the last one
            expect(component.selectedTag).toEqual('Typescript');

            // press tab and focus input again
            keyDown['keyCode'] = 9;
            component.tagElements[1].dispatchEvent(keyDown);
            expect(component.selectedTag).toEqual(undefined);
            expect(component.input.isFocused).toEqual(true);

            keyDown['keyCode'] = 8;
            // then starts from back again
            component.input.element.dispatchEvent(keyDown);
            expect(component.selectedTag).toEqual('Typescript');
            expect(component.input.isFocused).toEqual(false);

            // it removes current selected tag when pressing delete
            component.tagElements[1].dispatchEvent(keyDown);
            expect(component.items.length).toEqual(1);
            expect(component.selectedTag).toBe(undefined);
        }));

        it('it navigates back and forth between tags', fakeAsync(() => {
            const fixture: ComponentFixture<TestApp> = builder.createSync(TestApp);
            const component = getComponent(fixture);

            component.focus();

            keyDown['keyCode'] = 37;

            // press left arrow
            component.input.element.dispatchEvent(keyDown);
            // selected tag is the last one
            expect(component.selectedTag).toEqual('Typescript');

            // press left arrow
            component.tagElements[1].dispatchEvent(keyDown);
            expect(component.selectedTag).toEqual('Javascript');

            // press right arrow
            keyDown['keyCode'] = 39;
            component.tagElements[0].dispatchEvent(keyDown);
            expect(component.selectedTag).toEqual('Typescript');

            // press tab -> focuses input
            component.tagElements[1].dispatchEvent(keyDown);
            expect(component.selectedTag).toEqual(undefined);
            expect(component.input.isFocused).toEqual(true);
        }));

        it('it focuses input when pressing tab', fakeAsync(() => {
            const fixture: ComponentFixture<TestApp> = builder.createSync(TestApp);
            const component = getComponent(fixture);

            component.focus();

            keyUp['keyCode'] = 9;

            // press left arrow
            component.tagElements[0].dispatchEvent(keyDown);
            // selected tag is the last one
            expect(component.selectedTag).toEqual('Typescript');

            // press tab -> focuses input
            component.tagElements[1].dispatchEvent(keyDown);
            expect(component.selectedTag).toEqual(undefined);

            expect(component.input.isFocused).toEqual(true);
        }));
    });

    describe('when using a custom template', () => {
        const template =
            `<tag-input [(ngModel)]="items">
                 <div class="custom_class" *ngFor="let item of items" (click)="selectItem(item)">
                    <span class="tag__name">{{ item }}</span>
                    <span (click)="remove(item)"><img src="delete.png" /></span>
                 </div>
            </tag-input>`;

        it('replaced template with the custom one', fakeAsync(() => {
            const fixture: ComponentFixture<TestApp> = builder.overrideTemplate(TestApp, template).createSync(TestApp);
            const component = getComponent(fixture);

            expect(component.hasTemplate).toEqual(true);
            expect(component.items.length).toEqual(2);
            expect(component.element.nativeElement.querySelectorAll('.custom_class').length).toEqual(2);
        }));
    });

    describe('when using the autocomplete', () => {
        let template = `<tag-input [(ngModel)]="items" 
                                     [autocompleteItems]="['item1', 'item2', 'itam3']"
                                     [autocomplete]="true"></tag-input>`;

        let keyUp: Event = new Event('keyup');
        const iCode = 73;
        const tCode = 84;
        const aCode = 65;

        keyUp['keyCode'] = iCode;

        it('adds an autocomplete to the template', fakeAsync(() => {
            const fixture: ComponentFixture<TestApp> = builder.overrideTemplate(TestApp, template).createSync(TestApp);
            const component = getComponent(fixture);

            expect(component.autocomplete).toEqual(true);
            expect(component.autocompleteItems.length).toEqual(3);
            expect(component.element.nativeElement.querySelector('ng2-dropdown')).toBeTruthy();
        }));

        it('shows a dropdown when entering a matching value', fakeAsync(() => {
            const fixture: ComponentFixture<TestApp> = builder.overrideTemplate(TestApp, template).createSync(TestApp);
            const component = getComponent(fixture);

            // press 'i'
            component.setInputValue('i');
            component.input.element.dispatchEvent(keyUp);

            fixture.detectChanges();
            tick();

            const dropdown = document.querySelector('.ng2-dropdown-menu-container');
            const items = document.querySelectorAll('ng2-menu-item');

            expect(dropdown).toBeTruthy();
            expect(component.itemsMatching.length).toEqual(3);
            expect(items.length).toEqual(3);
        }));

        it('filters matching values', fakeAsync(() => {
            const fixture: ComponentFixture<TestApp> = builder.overrideTemplate(TestApp, template).createSync(TestApp);
            const component = getComponent(fixture);

            // press 'i'
            component.setInputValue('i');
            component.input.element.dispatchEvent(keyUp);

            fixture.detectChanges();
            tick();

            expect(component.itemsMatching.length).toEqual(3);
            component.itemsMatching = [];

            component.setInputValue('ite');
            component.input.element.dispatchEvent(keyUp);

            fixture.detectChanges();
            tick();

            expect(component.itemsMatching.length).toEqual(2);
            component.itemsMatching = [];

            fixture.detectChanges();
            tick();

            component.setInputValue('ita');
            component.input.element.dispatchEvent(keyUp);
            expect(component.itemsMatching.length).toEqual(1);
        }));

        it('adds items to tag input from autocomplete', fakeAsync(() => {
            const fixture: ComponentFixture<TestApp> = builder.overrideTemplate(TestApp, template).createSync(TestApp);
            const component = getComponent(fixture);

            expect(component.dropdown).toBeDefined();

            // press 'i'
            component.setInputValue('i');
            component.input.element.dispatchEvent(keyUp);

            fixture.detectChanges();
            tick();

            const item = component.dropdown.menu.items.first;
            component.dropdown.state.onItemClicked.emit(item);

            tick();

            expect(component.items.length).toEqual(3);
            expect(component.items.indexOf(item.value)).toEqual(2);
        }));

        it('does not let add item if onlyFromAutocomplete is set to true', fakeAsync(() => {
            template = `<tag-input [(ngModel)]="items" 
                                   [onlyFromAutocomplete]="true"
                                   [autocompleteItems]="['item1', 'item2', 'itam3']"
                                   [autocomplete]="true"></tag-input>`;

            const fixture: ComponentFixture<TestApp> = builder.overrideTemplate(TestApp, template).createSync(TestApp);
            const component = getComponent(fixture);

            component.setInputValue('item');
            component.addItem();
            expect(component.items.length).toEqual(2);

            component.setInputValue('item');
            component.addItem(true);
            expect(component.items.length).toEqual(3);
        }));
    });
});

@Component({
    selector: 'test-app',
    template: `<tag-input
                  [(ngModel)]="items"
                  (onRemove)="onRemove($event)"
                  (onAdd)="onAdd($event)">
              </tag-input>`,
    directives: [ TagInput ]
})
class TestApp {
    public items = getItems();
    public placeholder = '';

    onAdd(item) {

    }

    onRemove(item) {

    }

    validators = {
        minLength: Validators.minLength(3),
        startsWith: (control: FormControl) => {
            if (control.value.charAt(0) !== '@') {
                return {
                    'startsWithAt@': true
                };
            }
            return null;
        }
    };

    addPrefix(item: string) {
        return `prefix: ${item}`;
    }

    ngOnInit() {

    }
}

function getItems() {
    return ['Javascript', 'Typescript'];
}
