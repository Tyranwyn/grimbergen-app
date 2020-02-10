import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Store } from '@ngrx/store';

import * as fromRoot from '../../reducers';
import * as UserDataActions from '../../auth/state/user-data/user-data.actions';
import { EMPTY, from, Observable, of, Subscription } from 'rxjs';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, Validators } from '@angular/forms';
import { Category } from '../models/category';
import { CategoryService } from '../services/category.service';
import { ImageService } from '../services/image.service';
import { ReportService } from '../services/report.service';
import { catchError, filter, switchMap, take, tap } from 'rxjs/operators';
import { ReportInputDto } from '../models/report';
import { MailService } from '../services/mail.service';
import { environment } from '../../../environments/environment';
import { UserData } from '../../auth/user';
import { StatusUpdateService } from '../services/status-update.service';
import { StatusService } from '../services/status.service';
import { FileUploadComponent } from '../common/file-upload/file-upload.component';
import { DocumentReferenceService } from '../services/document-reference.service';
import { NomatimOSMService } from '../services/nomatim-osm.service';
import { Address, Result } from '../models/nomatim.types';
import { MatSnackBar } from '@angular/material/snack-bar';
import { createUserMail } from './user.mail';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: [ './home.component.scss' ]
})
export class HomeComponent implements OnInit, OnDestroy {

  private subs: Subscription[] = [];

  @ViewChild(FileUploadComponent, {static: false})
  fileUpload: FileUploadComponent;

  formGroup: FormGroup;

  $categories: Observable<Category[]>;
  results$: Observable<Result[]>;
  loading = false;

  constructor(private store: Store<fromRoot.State>,
              private fb: FormBuilder,
              private categoryService: CategoryService,
              private reportService: ReportService,
              private imageService: ImageService,
              private mailService: MailService,
              private statusUpdateService: StatusUpdateService,
              private statusService: StatusService,
              private docRefService: DocumentReferenceService,
              private nomatimService: NomatimOSMService,
              private snackBar: MatSnackBar) {
    this.$categories = categoryService.getCategories();
  }

  ngOnInit() {
    this.initForm();
    this.subs.push(this.store.select(fromRoot.getUserUid)
      .subscribe(uid => this.uid.setValue(uid)));
    this.subs.push(this.store.select(fromRoot.getUserDataSelector)
      .subscribe(userData => {
          this.firstName.setValue(userData.firstName);
          this.lastName.setValue(userData.lastName);
          this.email.setValue(userData.email);
        }
      ));
    this.getCurrentLocation();
  }

  initForm() {
    this.formGroup = this.fb.group({
      uid: [ null, Validators.required ],
      firstName: [ null, Validators.required ],
      lastName: [ null, Validators.required ],
      email: [ null, [ Validators.required, Validators.email ] ],
      locationCoords: [ null, Validators.required ],
      locationAddress: [ null, Validators.required ],
      locationMapsUrl: [ null, Validators.required ],
      locationDescription: null,
      category: [ null, Validators.required ],
      note: null,
      picture: [ null, Validators.required ],
    });
  }

  onLocationSelected(location: Result) {
    this.locationCoords.setValue({lat: location.lat, long: location.lon});
    this.locationMapsUrl.setValue(`${environment.nomatimApi}/search?q=${encodeURI(this.formatAddress(location.address))}`);
  }

  submit(formDirective: FormGroupDirective) {
    this.loading = true;
    this.store.dispatch(UserDataActions.UpdateUserData({id: this.uid.value, data: this.createPartialUserData()}));
    let resizedPictureUrl = '';
    this.imageService.saveReportImage(this.formGroup.get('picture').value)
      .pipe(
        take(1),
        switchMap(value => from(value.getDownloadURL())),
        switchMap(downloadURL => {
          resizedPictureUrl = downloadURL;
          return this.reportService.addReport(this.createReportDto(resizedPictureUrl));
        }),
        switchMap(reportRef => this.statusUpdateService.saveStatusUpdate('SENT', reportRef.id)),
        switchMap(ref => this.mailService.sendReportMail(this.createEmail(resizedPictureUrl, ref.id))),
        catchError(err => {
          this.loading = false;
          return of({failed: true, err});
        })
      ).subscribe(result => {
      if (result && result.failed) {
        console.log(result.err);
        this.snackBar.open('Er ging iets fout, probeer later nog eens', 'X', {
          duration: 2000,
        });
      } else {
        this.resetFormToDefault(formDirective);
        this.snackBar.open('Verzonden!', 'X', {
          duration: 2000,
        });
      }
    });
  }

  private addResizedExtension(name: string): string {
    const extensionIndex = name.lastIndexOf('.');
    return `${name.substring(0, extensionIndex)}_600x600${name.substring(extensionIndex)}`;
  }

  search($event: KeyboardEvent) {
    if (!$event.key.startsWith('Arrow')) {
      // @ts-ignore
      if ($event.target.value) {
        this.results$ = this.nomatimService.search({
          format: 'json',
          'accept-language': 'nl-BE',
          // @ts-ignore
          street: $event.target.value,
          city: 'Grimbergen',
          addressdetails: 1
        });
        this.clearLocation();
      } else {
        this.results$ = EMPTY;
      }
    }
  }

  private clearLocation() {
    this.locationCoords.setValue(null);
    this.locationMapsUrl.setValue(null);
  }

  formatAddress(address: Address): string {
    let formatted = address.road;
    if (address.house_number) {
      formatted = formatted.concat(' ' + address.house_number);
    }
    formatted = formatted.concat(', ');
    formatted = formatted.concat(address.postcode, ' ', address.city_district);
    return formatted;
  }

  private resetFormToDefault(formDirective: FormGroupDirective) {
    this.fileUpload.clearPreview();
    const firstName = this.firstName.value;
    const lastName = this.lastName.value;
    const email = this.email.value;
    formDirective.reset();
    this.firstName.setValue(firstName);
    this.lastName.setValue(lastName);
    this.email.setValue(email);
    this.loading = false;
  }

  private createPartialUserData(): Partial<UserData> {
    return {
      firstName: this.firstName.value,
      lastName: this.lastName.value,
      email: this.email.value
    };
  }

  private createReportDto(picture: string): ReportInputDto {
    return {
      userId: this.uid.value,
      categoryId: this.category.value,
      location: {
        address: this.locationAddress.value,
        mapsUrl: this.locationMapsUrl.value,
        lat: this.locationCoords.value.lat,
        long: this.locationCoords.value.long
      },
      locationDescription: this.locationDescription.value,
      note: this.note.value,
      picture
    };
  }

  private createEmail(pictureUrl: string, id: string) {
    return {
      to: environment.mailAddresses.toDefault,
      bcc: this.email.value,
      message: {
        subject: `Uw melding is gerapporteerd: ${this.locationAddress.value}, met id: ${id}`,
        html: createUserMail(id, pictureUrl, this.locationAddress.value, this.locationMapsUrl.value, this.firstName.value,
          this.lastName.value, new Date(Date.now()), this.locationDescription.value, this.note.value)
      }
    };
  }

  private getCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => this.reverseSearch(position),
        x => console.log(x), {enableHighAccuracy: true});
    }
  }

  private reverseSearch(position: Position) {
    this.nomatimService.reverse({
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      'accept-language': 'nl-BE',
      format: 'json'
    }).pipe(
      take(1),
      filter(value => value.display_name.toLowerCase().indexOf('grimbergen') !== -1),
    ).subscribe(result => {
      const formattedAddress = this.formatAddress(result.address);
      this.locationAddress.setValue(formattedAddress);
      this.locationCoords.setValue({lat: result.lat, long: result.lon});
      this.locationMapsUrl.setValue(`${environment.nomatimApi}/search?q=${encodeURI(formattedAddress)}`);
    });
  }

  get uid(): FormControl {
    return this.formGroup.get('uid') as FormControl;
  }

  get firstName(): FormControl {
    return this.formGroup.get('firstName') as FormControl;
  }

  get lastName(): FormControl {
    return this.formGroup.get('lastName') as FormControl;
  }

  get email(): FormControl {
    return this.formGroup.get('email') as FormControl;
  }

  get locationCoords(): FormControl {
    return this.formGroup.get('locationCoords') as FormControl;
  }

  get locationAddress(): FormControl {
    return this.formGroup.get('locationAddress') as FormControl;
  }

  get locationMapsUrl(): FormControl {
    return this.formGroup.get('locationMapsUrl') as FormControl;
  }

  get locationDescription(): FormControl {
    return this.formGroup.get('locationDescription') as FormControl;
  }

  get category(): FormControl {
    return this.formGroup.get('category') as FormControl;
  }

  get note(): FormControl {
    return this.formGroup.get('note') as FormControl;
  }

  get picture(): FormControl {
    return this.formGroup.get('picture') as FormControl;
  }

  ngOnDestroy(): void {
    this.subs.forEach(sub => sub.unsubscribe());
  }
}
