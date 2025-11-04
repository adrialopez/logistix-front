import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable({providedIn: 'root'})
export class ShopService {
  private shopSubject = new BehaviorSubject<string>(localStorage.getItem('shop')!);
  shop$ = this.shopSubject.asObservable();

  setShop(domain: string) {
    localStorage.setItem('shop', domain);
    this.shopSubject.next(domain);
  }
}
