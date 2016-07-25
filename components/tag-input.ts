import {
    Component,
    forwardRef,
    Input,
    Output,
    ElementRef,
    EventEmitter,
    Renderer,
    ViewChild,
    OnInit
} from '@angular/core';

import {
    FormGroup,
    FormControl,
    FormBuilder,
    Validators,
    NG_VALUE_ACCESSOR
} from '@angular/forms';

import {
    PLACEHOLDER,
    SECONDARY_PLACEHOLDER,
    KEYDOWN,
    KEYUP,
    MAX_ITEMS_WARNING,
    FOCUS
} from './constants';

import {
    backSpaceListener,
    autoCompleteListener,
    customSeparatorKeys,
    addListener,
    onAutocompleteItemClicked
} from './events-actions';

import {
    NG2_DROPDOWN_DIRECTIVES,
    Ng2Dropdown,
    Ng2DropdownComponent
} from 'ng2-material-dropdown';

import { TagInputAccessor } from './accessor';
import { getAction } from './keypress-actions';
import { TagInputComponent } from './tag-input.d';
import { DeleteIcon } from './icon/icon';
import { input } from './input-manager';

// tag-input Component


/**
 * A component for entering a list of terms to be used with ngModel.
 */
@Component({
    moduleId: module.id,
    selector: 'tag-input',
    directives: [ DeleteIcon, ...NG2_DROPDOWN_DIRECTIVES ],
    providers: [ {
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => TagInput),
        multi: true
    } ],
    styles: [ require('./style.scss').toString()] ,
    template: require('./template.html')
})
export class TagInput extends TagInputAccessor implements TagInputComponent, OnInit {
    /**
     * @name separatorKeys
     * @desc keyboard keys with which a user can separate items
     * @type {Array}
     */
    @Input() public separatorKeys: number[] = [];

    /**
     * @name placeholder
     * @desc the placeholder of the input text
     * @type {string}
     */
    @Input() public placeholder: string = PLACEHOLDER;

    /**
     * @name secondaryPlaceholder
     * @desc placeholder to appear when the input is empty
     * @type {string}
     */
    @Input() public secondaryPlaceholder: string = SECONDARY_PLACEHOLDER;

    /**
     * @name maxItems
     * @desc maximum number of items that can be added
     * @type {number}
     */
    @Input() public maxItems: number = undefined;

    /**
     * @name readonly
     * @desc if set to true, the user cannot remove/addItem new items
     * @type {boolean}
     */
    @Input() public readonly: boolean = undefined;

    /**
     * @name transform
     * @desc function passed to the component to transform the value of the items, or reject them instead
     */
    @Input() public transform: (item: string) => string = (item) => item;

    /**
     * @name validators
     * @desc array of Validators that are used to validate the tag before it gets appended to the list
     * @type {Validators[]}
     */
    @Input() public validators = [];

    /**
     * @name autocomplete
     * @desc sets if autocomplete is enabled. By default it's not.
     * @type {boolean}
     */
    @Input() public autocomplete: boolean = false;

    /**
     * @name autocompleteItems
     * @desc array of items that will populate the autocomplete
     * @type {Array<string>}
     */
    @Input() public autocompleteItems: string[] = undefined;

    @Input() public onlyFromAutocomplete: boolean = false;

    /**
     * @name onAdd
     * @desc event emitted when adding a new item
     * @type {EventEmitter<string>}
     */
    @Output() public onAdd = new EventEmitter<string>();

    /**
     * @name onRemove
     * @desc event emitted when removing an existing item
     * @type {EventEmitter<string>}
     */
    @Output() public onRemove = new EventEmitter<string>();

    /**
     * @name onSelect
     * @desc event emitted when selecting an item
     * @type {EventEmitter<string>}
     */
    @Output() public onSelect = new EventEmitter<string>();

    /**
     * @name template
     * @desc reference to the template if provided by the user
     * @type {ElementRef}
     */
    @ViewChild('template') public template: ElementRef;

    /**
     * @name dropdown
     */
    @ViewChild(Ng2Dropdown) public dropdown: Ng2DropdownComponent;

    public itemsMatching = [];
    public selectedTag: string;

    /**
     * @name hasTemplate
     * @desc boolean that returns whether the user has specified a template or not
     */
    private hasTemplate: boolean;

    /**
     * @name tagElements
     * @desc list of Element items
     */
    private tagElements: Element[];

    // Component private/public properties

    /**
     * @name input
     * @desc object representing utilities for managing the input text element
     */
    public input = Object.create(input);

    /**
     * @name listeners
     * @desc array of events that get fired using @fireEvents
     * @type []
     */
    private listeners = {
        [KEYDOWN]: <{(fun): any}[]>[],
        [KEYUP]: <{(fun): any}[]>[],
        change: <{(fun): any}[]>[]
    };

    /**
     * @name form
     * @type {ngForm}
     * @desc ngForm for handling the validation on the input text
     */
    private form: FormGroup;

    constructor(private element: ElementRef, private builder: FormBuilder, private renderer: Renderer) {
        super();
    }

    /**
     * @name removeItem
     * @desc removes an item from the array of the model
     * @param item {TagComponent}
     */
    public removeItem(item: string): void {
        this.items = this.items.filter(_item => _item !== item);

        // if the removed tag was selected, set it as undefined
        if (this.selectedTag === item) {
            this.selectedTag = undefined;
        }

        // focus input right after removing an item
        this.focus();

        // emit remove event
        this.onRemove.emit(item);
    }

    /**
     * @name addItem
     * @desc adds the current text model to the items array
     */
    public addItem(isFromAutocomplete = false): void {
        // update form value with the transformed item
        const item = this.setInputValue(this.form.value.item);

        // check if the transformed item is already existing in the list
        const isDupe = this.items.indexOf(item) !== -1;

        // check validity:
        // 1. form must be valid
        // 2. there must be no dupe
        // 3. check max items has not been reached
        // 4. check item comes from autocomplete
        // 5. or onlyFromAutocomplete is false
        const isValid = this.form.valid &&
            isDupe === false &&
            !this.maxItemsReached &&
            ((isFromAutocomplete && this.onlyFromAutocomplete === true) || this.onlyFromAutocomplete === false);

        // if valid:
        if (isValid) {
            // put items in array through filter to delete original reference (ngModel reference bug fix)
            this.items = this.items.filter(_item => _item);
            
            // append item to the ngModel list
            this.items.push(item);

            //  and emit event
            this.onAdd.emit(item);
        }

        // reset control
        this.setInputValue('');
    }

    /**
     * @name selectItem
     * @desc selects item passed as parameter as the selected tag
     * @param item
     */
    public selectItem(item: string): void {
        if (this.readonly) {
            const el = this.element.nativeElement;
            this.renderer.invokeElementMethod(el, FOCUS, []);
            return;
        }

        this.selectedTag = item;

        // emit event
        this.onSelect.emit(item);
    }

    /**
     * @name fireEvents
     * @desc goes through the list of the events for a given eventName, and fires each of them
     * @param eventName
     * @param $event
     */
    public fireEvents(eventName: string, $event?): void {
        this.listeners[eventName].forEach(listener => listener.call(this, $event));
    }

    /**
     * @name handleKeydown
     * @desc handles action when the user hits a keyboard key
     * @param $event
     * @param item
     */
    public handleKeydown($event, item: string): void {
        const action = getAction($event.keyCode || $event.which);
        const itemIndex = this.items.indexOf(item);

        // call action
        action.call(this, itemIndex);
        // prevent default behaviour
        $event.preventDefault();
    }

    /**
     * @name seyInputValue
     * @param value
     * @returns {string}
     */
    private setInputValue(value: string): string {
        const item = value ? this.transform(value) : '';
        const control = this.getControl();

        // update form value with the transformed item
        control.updateValue(item);

        return item;
    }

    /**
     * @name getControl
     * @returns {FormControl}
     */
    private getControl(): FormControl {
        return <FormControl>this.form.find('item');
    }

    private focus(): void {
        if (this.readonly) {
            return;
        }

        this.input.focus.call(this);
    }

    private blur(): void {
        this.input.blur.call(this);
    }

    private get maxItemsReached(): boolean {
        return this.maxItems !== undefined && this.items.length >= this.maxItems;
    }

    private escapeDropdown($event) {
        const isArrowUp = $event.keyCode === 38;
        const isFirstItemsSelected = this.dropdown.menu.items.first.isSelected;

        if (isArrowUp && isFirstItemsSelected) {
            this.focus();
        }
    }

    ngOnInit() {
        // setting up the keypress listeners
        addListener.call(this, KEYDOWN, backSpaceListener);
        addListener.call(this, KEYDOWN, customSeparatorKeys, this.separatorKeys.length > 0);

        // if the number of items specified in the model is > of the value of maxItems
        // degrade gracefully and let the max number of items to be the number of items in the model
        // though, warn the user.
        const maxItemsReached = this.maxItems !== undefined && this.items.length > this.maxItems;
        if (maxItemsReached) {
            this.maxItems = this.items.length;
            console.warn(MAX_ITEMS_WARNING);
        }

        // creating form
        this.form = this.builder.group({
            item: new FormControl('', Validators.compose(this.validators))
        });
    }

    ngAfterViewChecked() {
        this.input.element = this.input.element || this.element.nativeElement.querySelector('input');
        this.tagElements = this.element.nativeElement.querySelectorAll('.tag');
    }

    ngAfterViewInit() {
        const vm = this;
        vm.hasTemplate = vm.template && vm.template.nativeElement.childElementCount > 0;

        // if the template has been specified, remove the tags-container for the tags with default template
        // which will be replaced by <ng-content>
        if (vm.hasTemplate) {
            const el = vm.element.nativeElement;
            const form = el.querySelector('form');
            const customTagsContainer = el.querySelector('.tags-container--custom');
            const defaultTagsContainer = el.querySelector('.tags-container--default');

            vm.renderer.invokeElementMethod(customTagsContainer, 'appendChild', [form]);

            if (defaultTagsContainer) {
                vm.renderer.invokeElementMethod(defaultTagsContainer, 'remove', []);
            }
        }

        // if autocomplete is set to true, set up its events
        if (vm.autocomplete) {
            addListener.call(vm, KEYUP, autoCompleteListener);

            vm.dropdown.onItemClicked.subscribe(onAutocompleteItemClicked.bind(vm));

            vm.dropdown.onHide.subscribe(() => {
                vm.itemsMatching = [];
            });
        }
    }
}
