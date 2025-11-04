import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PackgoPage } from './packgo.page';

describe('PackgoPage', () => {
  let component: PackgoPage;
  let fixture: ComponentFixture<PackgoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PackgoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
