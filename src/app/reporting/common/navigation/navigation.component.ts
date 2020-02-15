import { Component, ViewChild } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable, Subscription } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import * as fromRoot from '../../../reducers';
import * as UserActions from '../../../auth/state/user/user.actions';
import { Router } from '@angular/router';
import { MatSidenav } from '@angular/material';
import { Role } from '../../../auth/user';

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: [ './navigation.component.scss' ]
})
export class NavigationComponent {

  @ViewChild('drawer', {static: false})
  drawer: MatSidenav;

  isHandsetSubscription: Subscription;

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );
  isHandset: boolean;
  currentRole$: Observable<Role>;
  privacyPolicyUrl = 'https://www.privacypolicygenerator.info/live.php?token=LwqGaD5pdhkVEqPuWwkW8no0l69i07it';

  constructor(private breakpointObserver: BreakpointObserver,
              private store: Store<fromRoot.State>,
              private router: Router) {
    this.isHandsetSubscription = this.isHandset$.subscribe(isHandset => this.isHandset = isHandset);
    this.currentRole$ = store.select(fromRoot.getUserDataRole);
  }

  logout() {
    this.store.dispatch(UserActions.Logout());
    this.router.navigateByUrl('login');
  }

  toggleDrawer() {
    if (this.isHandset) {
      this.drawer.toggle();
    }
  }
}
