import {Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {Status} from "../../../models/status";
import {MatTableDataSource} from "@angular/material/table";
import {MatSort} from "@angular/material/sort";
import {Crud} from "../../models/crud.enum";
import {DialogData} from "../../models/dialog-data.model";
import {filter} from "rxjs/operators";
import {
  DeleteDialogWarningData,
  DeleteWarningDialogComponent
} from "../../../common/delete-warning-dialog/delete-warning-dialog.component";
import {MatDialog} from "@angular/material/dialog";
import {Subscription} from "rxjs";
import {StatusDialogComponent} from "../status-dialog/status-dialog.component";

@Component({
  selector: 'app-statuses',
  templateUrl: './statuses.component.html',
  styleUrls: ['./statuses.component.scss']
})
export class StatusesComponent implements OnInit, OnDestroy {

  private subscriptions: Subscription[] = [];

  types = Crud;

  @ViewChild(MatSort, {static: true}) sort: MatSort;
  private _statuses: MatTableDataSource<Status>;
  private _columnsToDisplay = ['id', 'name', 'note'];
  isSmallScreen  = window.innerWidth <= 600;

  @Output()
  private statusEventEmitter = new EventEmitter<DialogData<Status>>();

  @Input()
  set statuses(statuses: Status[]) {
    this._statuses = new MatTableDataSource(statuses);
    if (statuses) {
      this._statuses.sort = this.sort;
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.isSmallScreen = window.innerWidth <= 600;
  }

  constructor(private dialog: MatDialog) {
  }

  ngOnInit() {
  }

  openDialog(type: Crud, status?: Status) {
    const dialogRef = this.dialog.open(StatusDialogComponent, {
      width: '20em',
      data: {type, resource: status} as DialogData<Status>
    });

    this.subscriptions.push(
      dialogRef.afterClosed().pipe(filter(result => result))
        .subscribe(result => this.statusEventEmitter.emit(result)));
  }

  deleteCategory(status: Status) {
    const dialogRef = this.dialog.open(DeleteWarningDialogComponent, {
      width: '20em',
      role: "alertdialog",
      data: {
        name: status.name,
        resource: status
      } as DeleteDialogWarningData
    });

    this.subscriptions.push(dialogRef.afterClosed()
      .pipe(filter(result => result))
      .subscribe((result: Status) =>
        this.statusEventEmitter.emit({type: Crud.DELETE, resource: result})));
  }

  get columnsToDisplay() {
    if (this.isSmallScreen) {
      return this._columnsToDisplay.slice(0, this._columnsToDisplay.length - 1);
    }
    return this._columnsToDisplay;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
