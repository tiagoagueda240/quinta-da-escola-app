import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Inscricao } from './inscricao';

describe('Inscricao', () => {
  let component: Inscricao;
  let fixture: ComponentFixture<Inscricao>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Inscricao]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Inscricao);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
