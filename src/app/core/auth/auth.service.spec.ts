import { CommonModule } from '@angular/common';
import {
  inject,
  TestBed,
  waitForAsync,
} from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
} from '@angular/router';
import {
  Store,
  StoreModule,
} from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { cold } from 'jasmine-marbles';
import {
  Observable,
  of,
} from 'rxjs';

import { REQUEST } from '../../../express.tokens';
import { AppState } from '../../app.reducer';
import { getMockTranslateService } from '../../shared/mocks/translate.service.mock';
import { NotificationsService } from '../../shared/notifications/notifications.service';
import { createSuccessfulRemoteDataObject$ } from '../../shared/remote-data.utils';
import { ActivatedRouteStub } from '../../shared/testing/active-router.stub';
import { AuthRequestServiceStub } from '../../shared/testing/auth-request-service.stub';
import { authMethodsMock } from '../../shared/testing/auth-service.stub';
import { EPersonMock } from '../../shared/testing/eperson.mock';
import { NotificationsServiceStub } from '../../shared/testing/notifications-service.stub';
import { routeServiceStub } from '../../shared/testing/route-service.stub';
import { RouterStub } from '../../shared/testing/router.stub';
import {
  SpecialGroupDataMock,
  SpecialGroupDataMock$,
} from '../../shared/testing/special-group.mock';
import { RemoteDataBuildService } from '../cache/builders/remote-data-build.service';
import { RemoteData } from '../data/remote-data';
import { EPersonDataService } from '../eperson/eperson-data.service';
import { EPerson } from '../eperson/models/eperson.model';
import { ClientCookieService } from '../services/client-cookie.service';
import { CookieService } from '../services/cookie.service';
import { HardRedirectService } from '../services/hard-redirect.service';
import { RouteService } from '../services/route.service';
import {
  NativeWindowRef,
  NativeWindowService,
} from '../services/window.service';
import {
  SetUserAsIdleAction,
  UnsetUserAsIdleAction,
} from './auth.actions';
import {
  authReducer,
  AuthState,
} from './auth.reducer';
import {
  AuthService,
  IMPERSONATING_COOKIE,
} from './auth.service';
import { AuthRequestService } from './auth-request.service';
import { AuthMethod } from './models/auth.method';
import { AuthStatus } from './models/auth-status.model';
import { AuthTokenInfo } from './models/auth-token-info.model';

describe('AuthService test', () => {

  const mockEpersonDataService: any = {
    findByHref(href: string): Observable<RemoteData<EPerson>> {
      return createSuccessfulRemoteDataObject$(EPersonMock);
    },
  };

  let mockStore: Store<AuthState>;
  let authService: AuthService;
  let routeServiceMock: RouteService;
  let authRequest;
  let window;
  let routerStub;
  let routeStub;
  let storage: CookieService;
  let token: AuthTokenInfo;
  let authenticatedState;
  let unAuthenticatedState;
  let idleState;
  let linkService;
  let hardRedirectService;

  const AuthStatusWithSpecialGroups = Object.assign(new AuthStatus(), {
    uuid: 'test',
    authenticated: true,
    okay: true,
    specialGroups: SpecialGroupDataMock$,
  });

  function init() {
    mockStore = jasmine.createSpyObj('store', {
      dispatch: {},
      pipe: of(true),
    });
    window = new NativeWindowRef();
    routerStub = new RouterStub();
    token = new AuthTokenInfo('test_token');
    token.expires = Date.now() + (1000 * 60 * 60);
    authenticatedState = {
      authenticated: true,
      loaded: true,
      loading: false,
      authToken: token,
      user: EPersonMock,
      idle: false,
    };
    unAuthenticatedState = {
      authenticated: false,
      loaded: true,
      loading: false,
      authToken: undefined,
      user: undefined,
      idle: false,
    };
    idleState = {
      authenticated: true,
      loaded: true,
      loading: false,
      authToken: token,
      user: EPersonMock,
      idle: true,
    };
    authRequest = new AuthRequestServiceStub();
    routeStub = new ActivatedRouteStub();
    linkService = {
      resolveLinks: {},
    };
    hardRedirectService = jasmine.createSpyObj('hardRedirectService', ['redirect', 'getCurrentRoute']);
    spyOn(linkService, 'resolveLinks').and.returnValue({ authenticated: true, eperson: of({ payload: {} }) });

  }

  describe('', () => {
    beforeEach(() => {
      init();
      TestBed.configureTestingModule({
        imports: [
          CommonModule,
          StoreModule.forRoot({ authReducer }, {
            runtimeChecks: {
              strictStateImmutability: false,
              strictActionImmutability: false,
            },
          }),
        ],
        providers: [
          { provide: AuthRequestService, useValue: authRequest },
          { provide: NativeWindowService, useValue: window },
          { provide: REQUEST, useValue: {} },
          { provide: Router, useValue: routerStub },
          { provide: RouteService, useValue: routeServiceStub },
          { provide: ActivatedRoute, useValue: routeStub },
          { provide: Store, useValue: mockStore },
          { provide: EPersonDataService, useValue: mockEpersonDataService },
          { provide: HardRedirectService, useValue: hardRedirectService },
          { provide: NotificationsService, useValue: NotificationsServiceStub },
          { provide: TranslateService, useValue: getMockTranslateService() },
          CookieService,
          AuthService,
        ],
      });
      authService = TestBed.inject(AuthService);
    });

    it('should return the authentication status object when user credentials are correct', () => {
      authService.authenticate('user', 'password').subscribe((status: AuthStatus) => {
        expect(status).toBeDefined();
      });
    });

    it('should throw an error when user credentials are wrong', () => {
      expect(authService.authenticate.bind(null, 'user', 'passwordwrong')).toThrow();
    });

    it('should return the authenticated user href when user token is valid', () => {
      authService.authenticatedUser(new AuthTokenInfo('test_token')).subscribe((userHref: string) => {
        expect(userHref).toBeDefined();
      });
    });

    it('should return the authenticated user', () => {
      authService.retrieveAuthenticatedUserByHref(EPersonMock._links.self.href).subscribe((user: EPerson) => {
        expect(user).toBeDefined();
      });
    });

    it('should throw an error when user credentials when user token is not valid', () => {
      expect(authService.authenticatedUser.bind(null, new AuthTokenInfo('test_token_expired'))).toThrow();
    });

    it('should return a valid refreshed token', () => {
      authService.refreshAuthenticationToken(new AuthTokenInfo('test_token')).subscribe((tokenState: AuthTokenInfo) => {
        expect(tokenState).toBeDefined();
      });
    });

    it('should throw an error when is not possible to refresh token', () => {
      expect(authService.refreshAuthenticationToken.bind(null, new AuthTokenInfo('test_token_expired'))).toThrow();
    });

    it('should return true when logout succeeded', () => {
      authService.logout().subscribe((status: boolean) => {
        expect(status).toBe(true);
      });
    });

    it('should throw an error when logout is not succeeded', () => {
      expect(authService.logout.bind(null)).toThrow();
    });

    it('should return the authentication status object to check an Authentication Cookie', () => {
      authService.checkAuthenticationCookie().subscribe((status: AuthStatus) => {
        expect(status).toBeDefined();
      });
    });

    it('should return the authentication methods available', () => {
      const authStatus = new AuthStatus();

      authService.retrieveAuthMethodsFromAuthStatus(authStatus).subscribe((authMethods: AuthMethod[]) => {
        expect(authMethods).toBeDefined();
        expect(authMethods.length).toBe(0);
      });

      authStatus.authMethods = authMethodsMock;
      authService.retrieveAuthMethodsFromAuthStatus(authStatus).subscribe((authMethods: AuthMethod[]) => {
        expect(authMethods).toBeDefined();
        expect(authMethods.length).toBe(2);
      });
    });

    describe('setIdle true', () => {
      beforeEach(() => {
        authService.setIdle(true);
      });

      it('store should dispatch SetUserAsIdleAction', () => {
        expect(mockStore.dispatch as jasmine.Spy).toHaveBeenCalledWith(new SetUserAsIdleAction());
      });
    });

    describe('setIdle false', () => {
      beforeEach(() => {
        authService.setIdle(false);
      });

      it('store should dispatch UnsetUserAsIdleAction', () => {
        expect(mockStore.dispatch as jasmine.Spy).toHaveBeenCalledWith(new UnsetUserAsIdleAction());
      });
    });
  });

  describe('', () => {

    beforeEach(waitForAsync(() => {
      init();
      TestBed.configureTestingModule({
        imports: [
          StoreModule.forRoot({ authReducer }, {
            runtimeChecks: {
              strictStateImmutability: false,
              strictActionImmutability: false,
            },
          }),
        ],
        providers: [
          { provide: AuthRequestService, useValue: authRequest },
          { provide: REQUEST, useValue: {} },
          { provide: Router, useValue: routerStub },
          { provide: RouteService, useValue: routeServiceStub },
          { provide: RemoteDataBuildService, useValue: linkService },
          CookieService,
          AuthService,
        ],
      }).compileComponents();
    }));

    beforeEach(inject([CookieService, AuthRequestService, Store, Router, RouteService], (cookieService: CookieService, authReqService: AuthRequestService, store: Store<AppState>, router: Router, routeService: RouteService, notificationsService: NotificationsService, translateService: TranslateService) => {
      store
        .subscribe((state) => {
          (state as any).core = Object.create({});
          (state as any).core.auth = authenticatedState;
        });
      authService = new AuthService(window, authReqService, mockEpersonDataService, router, routeService, cookieService, store, hardRedirectService, notificationsService, translateService);
    }));

    it('should return true when user is logged in', () => {
      authService.isAuthenticated().subscribe((status: boolean) => {
        expect(status).toBe(true);
      });
    });

    it('should return the shortlived token when user is logged in', () => {
      authService.getShortlivedToken().subscribe((shortlivedToken: string) => {
        expect(shortlivedToken).toEqual(authRequest.mockShortLivedToken);
      });
    });

    it('should return token object when it is valid', () => {
      authService.hasValidAuthenticationToken().subscribe((tokenState: AuthTokenInfo) => {
        expect(tokenState).toBe(token);
      });
    });

    it('should return a token object', () => {
      const result = authService.getToken();
      expect(result).toBe(token);
    });

    it('should return false when token is not expired', () => {
      const result = authService.isTokenExpired();
      expect(result).toBe(false);
    });

    it('should return true when authentication is loaded', () => {
      authService.isAuthenticationLoaded().subscribe((status: boolean) => {
        expect(status).toBe(true);
      });
    });

    it('isUserIdle should return false when user is not yet idle', () => {
      authService.isUserIdle().subscribe((status: boolean) => {
        expect(status).toBe(false);
      });
    });

  });

  describe('', () => {
    beforeEach(waitForAsync(() => {
      init();
      TestBed.configureTestingModule({
        imports: [
          StoreModule.forRoot({ authReducer }, {
            runtimeChecks: {
              strictStateImmutability: false,
              strictActionImmutability: false,
            },
          }),
        ],
        providers: [
          { provide: AuthRequestService, useValue: authRequest },
          { provide: REQUEST, useValue: {} },
          { provide: Router, useValue: routerStub },
          { provide: RouteService, useValue: routeServiceStub },
          { provide: RemoteDataBuildService, useValue: linkService },
          ClientCookieService,
          CookieService,
          AuthService,
        ],
      }).compileComponents();
    }));

    beforeEach(inject([ClientCookieService, AuthRequestService, Store, Router, RouteService], (cookieService: ClientCookieService, authReqService: AuthRequestService, store: Store<AppState>, router: Router, routeService: RouteService, notificationsService: NotificationsService, translateService: TranslateService) => {
      const expiredToken: AuthTokenInfo = new AuthTokenInfo('test_token');
      expiredToken.expires = Date.now() - (1000 * 60 * 60);
      authenticatedState = {
        authenticated: true,
        loaded: true,
        loading: false,
        authToken: expiredToken,
        user: EPersonMock,
      };
      store
        .subscribe((state) => {
          (state as any).core = Object.create({});
          (state as any).core.auth = authenticatedState;
        });
      authService = new AuthService(window, authReqService, mockEpersonDataService, router, routeService, cookieService, store, hardRedirectService, notificationsService, translateService);
      storage = (authService as any).storage;
      routeServiceMock = TestBed.inject(RouteService);
      routerStub = TestBed.inject(Router);
      spyOn(storage, 'get');
      spyOn(storage, 'remove');
      spyOn(storage, 'set');

    }));

    it('should throw false when token is not valid', () => {
      expect(authService.hasValidAuthenticationToken.bind(null)).toThrow();
    });

    it('should return true when token is expired', () => {
      const result = authService.isTokenExpired();
      expect(result).toBe(true);
    });

    it('should save token into storage', () => {
      authService.storeToken(token);
      expect(storage.set).toHaveBeenCalled();
    });

    it('should remove token from storage', () => {
      authService.removeToken();
      expect(storage.remove).toHaveBeenCalled();
    });

    it('should redirect to reload with redirect url', () => {
      authService.navigateToRedirectUrl('/collection/123');
      // Reload with redirect URL set to /collection/123
      expect(hardRedirectService.redirect).toHaveBeenCalledWith(jasmine.stringMatching(new RegExp('reload/[0-9]*\\?redirect=' + encodeURIComponent('/collection/123'))));
    });

    it('should redirect to reload with /home', () => {
      authService.navigateToRedirectUrl('/home');
      // Reload with redirect URL set to /home
      expect(hardRedirectService.redirect).toHaveBeenCalledWith(jasmine.stringMatching(new RegExp('reload/[0-9]*\\?redirect=' + encodeURIComponent('/home'))));
    });

    it('should redirect to regular reload and not to /login', () => {
      authService.navigateToRedirectUrl('/login');
      // Reload without a redirect URL
      expect(hardRedirectService.redirect).toHaveBeenCalledWith(jasmine.stringMatching(new RegExp('reload/[0-9]*(?!\\?)$')));
    });

    it('should redirect to regular reload when no redirect url is found', () => {
      authService.navigateToRedirectUrl(undefined);
      // Reload without a redirect URL
      expect(hardRedirectService.redirect).toHaveBeenCalledWith(jasmine.stringMatching(new RegExp('reload/[0-9]*(?!\\?)$')));
    });

    describe('impersonate', () => {
      const userId = 'testUserId';

      beforeEach(() => {
        spyOn(authService, 'refreshAfterLogout');
        authService.impersonate(userId);
      });

      it('should impersonate user', () => {
        expect(storage.set).toHaveBeenCalledWith(IMPERSONATING_COOKIE, userId);
      });

      it('should call refreshAfterLogout', () => {
        expect(authService.refreshAfterLogout).toHaveBeenCalled();
      });
    });

    describe('stopImpersonating', () => {
      beforeEach(() => {
        authService.stopImpersonating();
      });

      it('should impersonate user', () => {
        expect(storage.remove).toHaveBeenCalledWith(IMPERSONATING_COOKIE);
      });
    });

    describe('stopImpersonatingAndRefresh', () => {
      beforeEach(() => {
        spyOn(authService, 'refreshAfterLogout');
        authService.stopImpersonatingAndRefresh();
      });

      it('should impersonate user', () => {
        expect(storage.remove).toHaveBeenCalledWith(IMPERSONATING_COOKIE);
      });

      it('should call refreshAfterLogout', () => {
        expect(authService.refreshAfterLogout).toHaveBeenCalled();
      });
    });

    describe('getImpersonateID', () => {
      beforeEach(() => {
        authService.getImpersonateID();
      });

      it('should impersonate user', () => {
        expect(storage.get).toHaveBeenCalledWith(IMPERSONATING_COOKIE);
      });
    });

    describe('isImpersonating', () => {
      const userId = 'testUserId';
      let result: boolean;

      describe('when the cookie doesn\'t contain a value', () => {
        beforeEach(() => {
          result = authService.isImpersonating();
        });

        it('should return false', () => {
          expect(result).toBe(false);
        });
      });

      describe('when the cookie contains a value', () => {
        beforeEach(() => {
          storage.get = jasmine.createSpy().and.returnValue(userId);
          result = authService.isImpersonating();
        });

        it('should return true', () => {
          expect(result).toBe(true);
        });
      });
    });

    describe('isImpersonatingUser', () => {
      const userId = 'testUserId';
      let result: boolean;

      describe('when the cookie doesn\'t contain a value', () => {
        beforeEach(() => {
          result = authService.isImpersonatingUser(userId);
        });

        it('should return false', () => {
          expect(result).toBe(false);
        });
      });

      describe('when the cookie contains the right value', () => {
        beforeEach(() => {
          storage.get = jasmine.createSpy().and.returnValue(userId);
          result = authService.isImpersonatingUser(userId);
        });

        it('should return true', () => {
          expect(result).toBe(true);
        });
      });

      describe('when the cookie contains the wrong value', () => {
        beforeEach(() => {
          storage.get = jasmine.createSpy().and.returnValue('wrongValue');
          result = authService.isImpersonatingUser(userId);
        });

        it('should return false', () => {
          expect(result).toBe(false);
        });
      });
    });

    // TODO: remove?
    // Looks like redirecting to /home on logout is intentional
    // describe('refreshAfterLogout', () => {
    //   it('should call navigateToRedirectUrl with no url', () => {
    //     spyOn(authService as any, 'navigateToRedirectUrl').and.stub();
    //     authService.refreshAfterLogout();
    //     expect((authService as any).navigateToRedirectUrl).toHaveBeenCalled();
    //   });
    // });

    describe('getSpecialGroupsFromAuthStatus', () => {
      beforeEach(() => {
        spyOn(authRequest, 'getRequest').and.returnValue(createSuccessfulRemoteDataObject$(AuthStatusWithSpecialGroups));
      });

      it('should call navigateToRedirectUrl with no url', () => {
        const expectRes = cold('(a|)', {
          a: SpecialGroupDataMock,
        });
        expect(authService.getSpecialGroupsFromAuthStatus()).toBeObservable(expectRes);
      });
    });
  });

  describe('when user is not logged in', () => {
    beforeEach(waitForAsync(() => {
      init();
      TestBed.configureTestingModule({
        imports: [
          StoreModule.forRoot({ authReducer }, {
            runtimeChecks: {
              strictStateImmutability: false,
              strictActionImmutability: false,
            },
          }),
        ],
        providers: [
          { provide: AuthRequestService, useValue: authRequest },
          { provide: REQUEST, useValue: {} },
          { provide: Router, useValue: routerStub },
          { provide: RouteService, useValue: routeServiceStub },
          { provide: RemoteDataBuildService, useValue: linkService },
          CookieService,
          AuthService,
        ],
      }).compileComponents();
    }));

    beforeEach(inject([CookieService, AuthRequestService, Store, Router, RouteService], (cookieService: CookieService, authReqService: AuthRequestService, store: Store<AppState>, router: Router, routeService: RouteService, notificationsService: NotificationsService, translateService: TranslateService) => {
      store
        .subscribe((state) => {
          (state as any).core = Object.create({});
          (state as any).core.auth = unAuthenticatedState;
        });
      authService = new AuthService(window, authReqService, mockEpersonDataService, router, routeService, cookieService, store, hardRedirectService, notificationsService, translateService);
    }));

    it('should return null for the shortlived token', () => {
      authService.getShortlivedToken().subscribe((shortlivedToken: string) => {
        expect(shortlivedToken).toBeNull();
      });
    });
  });

  describe('when user is idle', () => {
    beforeEach(waitForAsync(() => {
      init();
      TestBed.configureTestingModule({
        imports: [
          StoreModule.forRoot({ authReducer }, {
            runtimeChecks: {
              strictStateImmutability: false,
              strictActionImmutability: false,
            },
          }),
        ],
        providers: [
          { provide: AuthRequestService, useValue: authRequest },
          { provide: REQUEST, useValue: {} },
          { provide: Router, useValue: routerStub },
          { provide: RouteService, useValue: routeServiceStub },
          { provide: RemoteDataBuildService, useValue: linkService },
          CookieService,
          AuthService,
        ],
      }).compileComponents();
    }));

    beforeEach(inject([CookieService, AuthRequestService, Store, Router, RouteService], (cookieService: CookieService, authReqService: AuthRequestService, store: Store<AppState>, router: Router, routeService: RouteService, notificationsService: NotificationsService, translateService: TranslateService) => {
      store
        .subscribe((state) => {
          (state as any).core = Object.create({});
          (state as any).core.auth = idleState;
        });
      authService = new AuthService(window, authReqService, mockEpersonDataService, router, routeService, cookieService, store, hardRedirectService, notificationsService, translateService);
    }));

    it('isUserIdle should return true when user is not idle', () => {
      authService.isUserIdle().subscribe((status: boolean) => {
        expect(status).toBe(true);
      });
    });
  });

  describe('refreshAfterLogout normal cases', () => {

    beforeEach(() => {
      init();
      TestBed.configureTestingModule({
        imports: [
          CommonModule,
          StoreModule.forRoot({ authReducer }, {
            runtimeChecks: {
              strictStateImmutability: false,
              strictActionImmutability: false,
            },
          }),
        ],
        providers: [
          { provide: AuthRequestService, useValue: authRequest },
          { provide: NativeWindowService, useValue: window },
          { provide: REQUEST, useValue: {} },
          { provide: Router, useValue: routerStub },
          { provide: RouteService, useValue: routeServiceStub },
          { provide: ActivatedRoute, useValue: routeStub },
          { provide: Store, useValue: mockStore },
          { provide: EPersonDataService, useValue: mockEpersonDataService },
          { provide: HardRedirectService, useValue: hardRedirectService },
          { provide: NotificationsService, useValue: NotificationsServiceStub },
          { provide: TranslateService, useValue: getMockTranslateService() },
          CookieService,
          AuthService,
        ],
      });
      authService = TestBed.inject(AuthService);
    });

    it('should pass current route to navigateToRedirectUrl (concrete case)', () => {
      const currentRoute = '/search?query=open+access';
      hardRedirectService.getCurrentRoute.and.returnValue(currentRoute);
      spyOn(authService as any, 'navigateToRedirectUrl').and.stub();
      authService.refreshAfterLogout();
      expect((authService as any).navigateToRedirectUrl).toHaveBeenCalledWith(currentRoute);
    });

    it('should pass current route for item page', () => {
      const currentRoute = '/items/abc-123';
      hardRedirectService.getCurrentRoute.and.returnValue(currentRoute);
      spyOn(authService as any, 'navigateToRedirectUrl').and.stub();
      authService.refreshAfterLogout();
      expect((authService as any).navigateToRedirectUrl).toHaveBeenCalledWith(currentRoute);
    });

    it('should pass current route for community page', () => {
      const currentRoute = '/communities/xyz';
      hardRedirectService.getCurrentRoute.and.returnValue(currentRoute);
      spyOn(authService as any, 'navigateToRedirectUrl').and.stub();
      authService.refreshAfterLogout();
      expect((authService as any).navigateToRedirectUrl).toHaveBeenCalledWith(currentRoute);
    });

    /**
     * Property-based test: generate random valid route strings and verify
     * refreshAfterLogout() passes them through to navigateToRedirectUrl().
     *
     * Since this project uses Jasmine (not fast-check), we implement this
     * as a loop over generated test cases.
     */
    it('should pass any valid non-login/non-logout route to navigateToRedirectUrl (property-based)', () => {
      const pathSegments = [
        'search', 'items', 'communities', 'collections', 'home',
        'browse', 'statistics', 'profile', 'admin', 'submit',
      ];
      const queryParams = [
        '', '?query=open+access', '?page=2&size=10',
        '?f.author=Smith&f.dateIssued.min=2020',
        '?query=test&sort=score&order=desc',
      ];

      const generatedRoutes: string[] = [];
      for (const segment of pathSegments) {
        for (const query of queryParams) {
          const route = `/${segment}${query}`;
          if (!route.startsWith('/login') && !route.startsWith('/logout')) {
            generatedRoutes.push(route);
          }
        }
      }

      const navSpy = spyOn(authService as any, 'navigateToRedirectUrl').and.stub();

      for (const route of generatedRoutes) {
        navSpy.calls.reset();
        hardRedirectService.getCurrentRoute.and.returnValue(route);
        authService.refreshAfterLogout();
        expect((authService as any).navigateToRedirectUrl)
          .withContext(`Expected navigateToRedirectUrl('${route}') but got navigateToRedirectUrl(${navSpy.calls.mostRecent().args[0]})`)
          .toHaveBeenCalledWith(route);
      }
    });
  });

  describe('refreshAfterLogout preservation', () => {
    /**
     * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
     *
     * Property 2: Preservation - Existing Logout Mechanics and Route Filtering Unchanged
     *
     * These tests capture the baseline behavior of the UNFIXED code for non-bug-condition
     * inputs. They MUST PASS on unfixed code and continue to pass after the fix is applied.
     *
     * Observations on UNFIXED code:
     * - navigateToRedirectUrl(undefined) → redirect to reload/{timestamp} with no ?redirect= param
     * - navigateToRedirectUrl('/login') → does NOT include ?redirect=/login (existing filter)
     * - navigateToRedirectUrl('/collection/123') → includes ?redirect=%2Fcollection%2F123
     * - refreshAfterLogout() always calls navigateToRedirectUrl(undefined) on unfixed code
     */

    beforeEach(waitForAsync(() => {
      init();
      TestBed.configureTestingModule({
        imports: [
          StoreModule.forRoot({ authReducer }, {
            runtimeChecks: {
              strictStateImmutability: false,
              strictActionImmutability: false,
            },
          }),
        ],
        providers: [
          { provide: AuthRequestService, useValue: authRequest },
          { provide: REQUEST, useValue: {} },
          { provide: Router, useValue: routerStub },
          { provide: RouteService, useValue: routeServiceStub },
          { provide: RemoteDataBuildService, useValue: linkService },
          ClientCookieService,
          CookieService,
          AuthService,
        ],
      }).compileComponents();
    }));

    beforeEach(inject([ClientCookieService, AuthRequestService, Store, Router, RouteService],
      (cookieService: ClientCookieService, authReqService: AuthRequestService, store: Store<AppState>, router: Router, routeService: RouteService) => {
        store.subscribe((state) => {
          (state as any).core = Object.create({});
          (state as any).core.auth = authenticatedState;
        });
        authService = new AuthService(window, authReqService, mockEpersonDataService, router, routeService, cookieService, store, hardRedirectService, NotificationsServiceStub as any, getMockTranslateService() as any);
        storage = (authService as any).storage;
        spyOn(storage, 'get');
        spyOn(storage, 'remove');
        spyOn(storage, 'set');
      },
    ));

    describe('navigateToRedirectUrl login route filtering (property-based)', () => {
      /**
       * For any route starting with /login, navigateToRedirectUrl should NOT
       * append a ?redirect= parameter. This is the existing filter that must
       * be preserved after the fix.
       */
      it('should NOT append ?redirect= for any route starting with /login', () => {
        const loginVariants = [
          '/login',
          '/login?expired=true',
          '/login?redirect=%2Fhome',
          '/login/shibboleth',
          '/login?foo=bar&baz=qux',
        ];

        for (const route of loginVariants) {
          hardRedirectService.redirect.calls.reset();
          authService.navigateToRedirectUrl(route);
          const redirectArg = hardRedirectService.redirect.calls.mostRecent().args[0];
          expect(redirectArg)
            .withContext(`navigateToRedirectUrl('${route}') should not include ?redirect=`)
            .toMatch(/^reload\/[0-9]+$/);
        }
      });
    });

    describe('navigateToRedirectUrl with undefined/empty inputs', () => {
      /**
       * For undefined or empty inputs, navigateToRedirectUrl should redirect
       * to reload/{timestamp} with no query param.
       */
      it('should redirect to reload/{timestamp} with no ?redirect= when input is undefined', () => {
        authService.navigateToRedirectUrl(undefined);
        expect(hardRedirectService.redirect).toHaveBeenCalledWith(
          jasmine.stringMatching(/^reload\/[0-9]+$/),
        );
      });

      it('should redirect to reload/{timestamp} with no ?redirect= when input is empty string', () => {
        authService.navigateToRedirectUrl('');
        expect(hardRedirectService.redirect).toHaveBeenCalledWith(
          jasmine.stringMatching(/^reload\/[0-9]+$/),
        );
      });

      it('should redirect to reload/{timestamp} with no ?redirect= when input is null', () => {
        authService.navigateToRedirectUrl(null);
        expect(hardRedirectService.redirect).toHaveBeenCalledWith(
          jasmine.stringMatching(/^reload\/[0-9]+$/),
        );
      });
    });

    describe('refreshAfterLogout with /logout routes', () => {
      /**
       * On UNFIXED code, refreshAfterLogout() always passes undefined to
       * navigateToRedirectUrl(), regardless of getCurrentRoute(). So for
       * /logout routes, the result is the same: redirect to reload/{timestamp}
       * with no ?redirect= param.
       *
       * After the fix, /logout routes should STILL result in undefined being
       * passed (new filter), so the behavior is preserved.
       */
      it('should result in redirect to reload/{timestamp} with no ?redirect= for /logout routes (property-based)', () => {
        const logoutVariants = [
          '/logout',
          '/logout?reason=idle',
          '/logout?redirect=%2Fhome',
        ];

        for (const route of logoutVariants) {
          hardRedirectService.redirect.calls.reset();
          hardRedirectService.getCurrentRoute.and.returnValue(route);
          authService.refreshAfterLogout();
          const redirectArg = hardRedirectService.redirect.calls.mostRecent().args[0];
          expect(redirectArg)
            .withContext(`refreshAfterLogout() with getCurrentRoute()='${route}' should redirect to reload/{timestamp} with no ?redirect=`)
            .toMatch(/^reload\/[0-9]+$/);
        }
      });
    });

    describe('navigateToRedirectUrl preserves redirect for valid routes (property-based)', () => {
      /**
       * For valid non-login routes, navigateToRedirectUrl should append
       * ?redirect=<encoded-route>. This existing behavior must be preserved.
       */
      it('should append ?redirect= for valid non-login routes', () => {
        const validRoutes = [
          '/collection/123',
          '/home',
          '/search?query=test',
          '/items/abc-123',
          '/communities/xyz',
          '/browse/title?startsWith=A',
          '/statistics',
          '/profile',
        ];

        for (const route of validRoutes) {
          hardRedirectService.redirect.calls.reset();
          authService.navigateToRedirectUrl(route);
          const redirectArg = hardRedirectService.redirect.calls.mostRecent().args[0];
          const expectedPattern = new RegExp(
            '^reload/[0-9]+\\?redirect=' + encodeURIComponent(route).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$',
          );
          expect(redirectArg)
            .withContext(`navigateToRedirectUrl('${route}') should include ?redirect=${encodeURIComponent(route)}`)
            .toMatch(expectedPattern);
        }
      });
    });

    describe('impersonate preservation', () => {
      /**
       * impersonate() must still store the impersonation cookie AND call
       * refreshAfterLogout(). This behavior must be preserved after the fix.
       */
      it('should store impersonation cookie and call refreshAfterLogout', () => {
        const userId = 'testUserId';
        spyOn(authService, 'refreshAfterLogout');
        authService.impersonate(userId);
        expect(storage.set).toHaveBeenCalledWith(IMPERSONATING_COOKIE, userId);
        expect(authService.refreshAfterLogout).toHaveBeenCalled();
      });
    });

    describe('stopImpersonatingAndRefresh preservation', () => {
      /**
       * stopImpersonatingAndRefresh() must still call stopImpersonating()
       * (which removes the cookie) and then call refreshAfterLogout().
       */
      it('should remove impersonation cookie and call refreshAfterLogout', () => {
        spyOn(authService, 'refreshAfterLogout');
        authService.stopImpersonatingAndRefresh();
        expect(storage.remove).toHaveBeenCalledWith(IMPERSONATING_COOKIE);
        expect(authService.refreshAfterLogout).toHaveBeenCalled();
      });
    });
  });
});
