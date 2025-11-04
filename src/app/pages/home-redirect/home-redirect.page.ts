import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from 'src/app/shared/services/auth.service';

@Component({
    standalone: true,
    template: ''
})
export class HomeRedirectPage implements OnInit {

      private destroy$ = new Subject<void>();
    
    constructor(private auth: AuthService, private router: Router) { }

    ngOnInit() {
        this.auth.role$
            .pipe(takeUntil(this.destroy$))
            .subscribe(role => {
                if (role === 'picker') {
                    this.router.navigate(['/packgo']);
                } else {
                    this.router.navigate(['/pedidos']);
                }
            });

    }
}
