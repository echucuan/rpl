// Generates a self-contained MATLAB script that reproduces the student's flight with the same
// model as RPL, except that the rocket's drag coefficient is held constant.
import type { Design } from "../model";
import { PSI } from "../model";
import { motorById } from "../catalog";
import { groundPressure } from "../physics/atmosphere";
import { centreOfMass, layout, structureItems } from "../physics/geometry";
import { simulate, type FlightResult } from "../physics/simulate";
import { flightPhases } from "./phases";
import { PROGRAMS } from "./StartScreen";
import { downloadFile } from "./storage";

const num = (v: number, d = 4) => Number(v.toFixed(d)).toString();

function vector(values: number[], digits: number): string {
  const parts = values.map((v) => num(v, digits));
  const rows: string[] = [];
  for (let i = 0; i < parts.length; i += 8) rows.push(parts.slice(i, i + 8).join(" "));
  return `[${rows.join(" ...\n           ")}]`;
}

/** Valid MATLAB file name (letters, digits, underscores; starts with a letter). */
export function matlabFileName(name: string): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return `rpl_${base || "cohete"}.m`;
}

/** Constant drag coefficient used by the script: RPL's average during phase 2. */
export function constantCd(r: FlightResult): number {
  const ph = flightPhases(r).find((p) => p.id === 2)!;
  const s = r.samples.filter((x) => x.t >= ph.from && x.t <= ph.to && x.cd > 0);
  const cd = s.length ? s.reduce((a, x) => a + x.cd, 0) / s.length : r.samples.find((x) => x.cd > 0)?.cd ?? 0.6;
  return Number(cd.toFixed(3));
}

export function matlabScript(d: Design, r: FlightResult): string {
  const cd = constantCd(r);
  const check = simulate({ ...d, cdOverride: cd });
  const expected = typeof check === "string" ? null : check;
  const l = layout(d);
  const dry = centreOfMass(structureItems(d)).mass / 1000;
  const program = PROGRAMS[d.type];
  const chute = d.recovery.kind === "parachute" && d.recovery.deployment !== "none";
  const date = new Date().toLocaleDateString("es-MX", { dateStyle: "long" });
  const water = d.type === "water";

  const header = `%% Rocket Physics Lab - simulación de "${d.name.replace(/"/g, "'")}"
% ${program.name} (${program.fuel.toLowerCase()}) · generado el ${date}
% Metodología: Física -> Matemáticas -> Computación
%
% Resuelve el mismo modelo que RPL con una simplificación: el coeficiente de
% arrastre del cohete es constante, Cd = ${num(cd, 3)} (el promedio de RPL en la fase 2).
${expected ? `% Si el script funciona bien, debe dar aproximadamente:
%   altura máxima    = ${num(expected.apogee.h, 1)} m a los ${num(expected.apogee.t, 2)} s
%   velocidad máxima = ${num(expected.maxVelocity, 1)} m/s
%   aterrizaje       = ${num(expected.descentRate, 1)} m/s a los ${num(expected.landing?.t ?? 0, 1)} s
% (RPL, con Cd variable, predice ${num(r.apogee.h, 1)} m de altura máxima.)` : ""}
%
% Requiere MATLAB R2016b o más reciente (funciones locales al final del script).

clear; clc; close all;

%% 1. FÍSICA: datos del cohete, del sitio y de la propulsión
p.g       = 9.80665;                  % m/s^2
p.R       = 287.053;                  % J/(kg K), constante del aire
p.h_sitio = ${num(d.launch.altitude, 1)};                     % m sobre el nivel del mar
p.T0      = ${num(d.launch.temperature, 1)} + 273.15;             % K, temperatura en el suelo
p.P0      = ${num(groundPressure(d.launch.altitude), 1)};               % Pa, presión en el suelo

p.m_seca  = ${num(dry, 5)};                % kg, cohete sin ${water ? "agua" : "motor"}
p.d       = ${num(l.refDiameter / 1000, 4)};                 % m, diámetro
p.A       = pi*p.d^2/4;               % m^2, área frontal
p.Cd      = ${num(cd, 3)};                  % coeficiente de arrastre (constante)
p.guia    = ${num(d.launch.guideLength, 2)};                   % m, largo de la guía

% Paracaídas
p.tiene_paracaidas = ${chute ? "true" : "false"};
p.Dp  = ${num(d.recovery.diameter / 1000, 3)};  p.Cdp = ${num(d.recovery.cd, 2)};  p.Ap = pi*p.Dp^2/4;
p.paracaidas = false;                 % cambia a true cuando se abre
`;

  let propulsion: string;
  if (d.type === "estes") {
    const m = motorById(d.motor.id)!;
    propulsion = `
% Motor ${m.name}-${d.motor.delay} (curva de empuje medida)
p.agua    = false;
p.t_tab   = ${vector(m.time, 3)};   % s
p.T_tab   = ${vector(m.thrust, 2)};   % N
p.m_tab   = ${vector(m.mass, 2)}/1000;   % kg, masa del motor
p.t_b     = p.t_tab(end);             % s, fin del empuje
p.retardo = ${d.motor.delay};                       % s, retardo hasta la eyección
`;
  } else {
    const w = d.water;
    propulsion = `
% Botella de agua y aire a presión
p.agua      = true;
p.V_botella = ${num(w.bottleVolume / 1000, 6)};               % m^3
p.Vw0       = ${num(Math.min(w.waterVolume, w.bottleVolume * 0.98) / 1000, 6)};               % m^3 de agua al inicio
p.P_man     = ${num(w.pressure, 1)}*${PSI};          % Pa, presión del manómetro (psi -> Pa)
p.An        = pi*${num(w.nozzleDiameter / 1000, 4)}^2/4;          % m^2, boquilla
p.Ab        = pi*${num(d.body.diameter / 1000, 4)}^2/4;          % m^2, sección de la botella
p.rho_w     = 997;                    % kg/m^3
p.gamma     = 1.4;
p.Cd_n      = 0.97;                   % coeficiente de descarga de la boquilla
p.P_ini     = p.P0 + p.P_man;         % Pa, presión absoluta inicial
p.rho0      = p.P_ini/(p.R*p.T0);     % kg/m^3, densidad inicial del aire
p.factor    = 1 - min((p.An/p.Ab)^2, 0.9);
`;
  }

  const math = `
%% 2. MATEMÁTICAS: el modelo
%   dh/dt = v
%   dv/dt = (T(t) - D)/m(t) - g,      D = 1/2*rho(h)*v*|v|*Cd*A  (+ paracaídas)
%   rho(h) = P(h)/(R*T(h)),           T(h) = T0 - 0.0065*h
${water ? `%   Agua: p = p0*(Va0/Va)^gamma,  u = sqrt(2(p-pa)/(rho_w*factor)),
%         dVw/dt = -Cd_n*An*u,     T = rho_w*Cd_n*An*u^2
%   Aire (al acabarse el agua): flujo sónico por la boquilla` : `%   T(t) y m(t): interpolación lineal de la tabla del motor`}
% Todo está en la función "derivadas" al final del script.
`;

  const steps = water ? "[0.00005 0.0001 0.0002 0.0005 0.001 0.002]" : "[0.0005 0.001 0.002 0.005 0.01 0.02 0.05]";
  const compute = `
%% 3. COMPUTACIÓN: integración numérica con Runge-Kutta 4
r = simular(p, @paso_rk4, [], false);

fprintf('--- Resultados (RK4) ---\\n');
fprintf('Fin del empuje:   %.3f s\\n', r.t_b);
fprintf('Velocidad máxima: %.1f m/s\\n', max(r.v));
fprintf('Altura máxima:    %.1f m a los %.2f s\\n', r.h_apogeo, r.t_apogeo);
if ~isnan(r.t_par), fprintf('Paracaídas:       se abre a los %.2f s\\n', r.t_par); end
fprintf('Aterrizaje:       %.1f m/s a los %.1f s\\n', r.v_suelo, r.t_suelo);

%% 4. Gráficas por fases
figure('Name', 'Vuelo por fases', 'Color', 'w');
subplot(3,1,1); plot(r.t, r.h, 'LineWidth', 1.5); grid on; ylabel('Altura (m)');
title('Fase 1 Empuje · Fase 2 Frenado · Fase 3 Caída libre · Fase 4 Paracaídas'); sombrear_fases(r);
subplot(3,1,2); plot(r.t, r.v, 'LineWidth', 1.5); grid on; ylabel('Velocidad (m/s)'); sombrear_fases(r);
subplot(3,1,3); plot(r.t, r.a, 'LineWidth', 1.5); grid on; ylabel('Aceleración (m/s^2)');
xlabel('Tiempo (s)'); sombrear_fases(r);

% Acercamiento al ascenso (fases 1 a 3), donde todo cambia rápido
figure('Name', 'Ascenso', 'Color', 'w');
t_zoom = min(r.t(end), 1.5*r.t_apogeo + 0.5);
subplot(3,1,1); plot(r.t, r.h, 'LineWidth', 1.5); grid on; ylabel('Altura (m)'); xlim([0 t_zoom]);
title('Ascenso'); sombrear_fases(r);
subplot(3,1,2); plot(r.t, r.v, 'LineWidth', 1.5); grid on; ylabel('Velocidad (m/s)'); xlim([0 t_zoom]); sombrear_fases(r);
subplot(3,1,3); plot(r.t, r.a, 'LineWidth', 1.5); grid on; ylabel('Aceleración (m/s^2)'); xlim([0 t_zoom]);
xlabel('Tiempo (s)'); sombrear_fases(r);

%% 5. Método numérico: Euler contra RK4 (solo el ascenso)
pasos = ${steps};
ref = simular(p, @paso_rk4, [], true);
hE = zeros(size(pasos));  hR = zeros(size(pasos));
for i = 1:numel(pasos)
    rE = simular(p, @paso_euler, pasos(i), true);  hE(i) = rE.h_apogeo;
    rR = simular(p, @paso_rk4,   pasos(i), true);  hR(i) = rR.h_apogeo;
end
figure('Name', 'Convergencia', 'Color', 'w');
loglog(pasos, abs(hE - ref.h_apogeo) + eps, 'o-', pasos, abs(hR - ref.h_apogeo) + eps, 's-', 'LineWidth', 1.5);
grid on; xlabel('\\Delta t (s)'); ylabel('error en la altura máxima (m)');
legend('Euler', 'RK4', 'Location', 'northwest');
disp(table(pasos(:), hE(:), hR(:), 'VariableNames', {'dt', 'h_Euler', 'h_RK4'}));
`;

  const functions = `
%% ===================== Funciones locales =====================

function r = simular(p, paso, dt_fijo, hasta_apogeo)
% Integra el vuelo. paso: @paso_rk4 o @paso_euler. dt_fijo = [] usa paso variable.
    t = 0;
    if p.agua
        y = [0; 0; p.Vw0; p.rho0*(p.V_botella - p.Vw0)];   % [h; v; Vw; m_aire]
    else
        y = [0; 0];                                          % [h; v]
    end
    [dy, activo] = derivadas(t, y, p);
    r.t = 0;  r.h = 0;  r.v = 0;  r.a = dy(2);
    r.t_b = NaN;  r.t_apogeo = NaN;  r.h_apogeo = 0;  r.t_par = NaN;
    r.t_suelo = NaN;  r.v_suelo = NaN;
    despego = false;
    while t < 600
        if isempty(dt_fijo)
            if activo
                if p.agua, dt = 5e-5; else, dt = 5e-4; end   % el empuje cambia rápido
            elseif p.paracaidas
                dt = 0.01;
            else
                dt = 2e-3;
            end
        else
            dt = dt_fijo;
        end
        y_nuevo = paso(@derivadas, t, y, dt, p);
        if y_nuevo(1) <= 0 && ~despego                       % aún en la plataforma
            y_nuevo(1) = 0;  y_nuevo(2) = max(y_nuevo(2), 0);
        end
        t = t + dt;
        if y_nuevo(1) > 0.001, despego = true; end
        [dy, activo_nuevo] = derivadas(t, y_nuevo, p);
        if activo && ~activo_nuevo && isnan(r.t_b), r.t_b = t; end          % fin de la fase 1
        if despego && isnan(r.t_apogeo) && y(2) > 0 && y_nuevo(2) <= 0     % fin de la fase 2
            r.t_apogeo = t;  r.h_apogeo = y_nuevo(1);
            if p.agua && p.tiene_paracaidas, p.paracaidas = true; r.t_par = t; end
        end
        if ~p.agua && p.tiene_paracaidas && p.retardo > 0 && ~p.paracaidas && t >= p.t_b + p.retardo
            p.paracaidas = true;  r.t_par = t;                % eyección del motor
        end
        activo = activo_nuevo;
        y = y_nuevo;
        r.t(end+1) = t;  r.h(end+1) = max(y(1), 0);  r.v(end+1) = y(2);  r.a(end+1) = dy(2);
        if hasta_apogeo && ~isnan(r.t_apogeo), break; end
        if despego && y(1) <= 0 && y(2) < 0                  % aterrizaje
            r.t_suelo = t;  r.v_suelo = abs(y(2));
            break
        end
        if ~despego && t > 5, break; end                     % nunca despegó
    end
end

function [dydt, activo] = derivadas(t, y, p)
% f(t, y): derivadas del estado. activo = hay empuje.
    h = y(1);  v = y(2);
    [rho, Pa] = atmosfera(max(h, 0), p);
    if p.agua
        [T, dVw, dma, m_prop, activo] = empuje_agua(y(3), y(4), Pa, p);
    else
        activo = t < p.t_b;
        if activo, T = interp1(p.t_tab, p.T_tab, t); else, T = 0; end
        m_prop = interp1(p.t_tab, p.m_tab, min(t, p.t_b));
    end
    m = p.m_seca + m_prop;
    CdA = p.Cd*p.A;
    if p.paracaidas, CdA = CdA + p.Cdp*p.Ap; end
    D = 0.5*rho*v*abs(v)*CdA;                                % arrastre
    a = (T - D)/m - p.g;                                     % segunda ley de Newton
    if h <= 0 && v <= 0 && a < 0, a = 0; end                 % sobre la plataforma
    if p.agua
        dydt = [v; a; dVw; dma];
    else
        dydt = [v; a];
    end
end

function [rho, P] = atmosfera(h, p)
% Atmósfera estándar ajustada a la temperatura del sitio.
    T = max(p.T0 - 0.0065*h, 150);
    P = p.P0*(T/p.T0)^(p.g/(p.R*0.0065));
    rho = P/(p.R*T);
end
${water ? `
function [T, dVw, dma, m_prop, activo] = empuje_agua(Vw, ma, Pa, p)
% Empuje de la botella: primero sale el agua, después el aire.
    agua  = max(Vw, 0);
    Va    = p.V_botella - agua;
    rho_a = max(ma, 0)/Va;
    P     = p.P_ini*(rho_a/p.rho0)^p.gamma;                  % expansión adiabática
    m_prop = agua*p.rho_w + max(ma, 0);
    T = 0;  dVw = 0;  dma = 0;  activo = false;
    if P <= Pa*1.0005, return; end
    activo = true;
    if agua > 0
        u   = sqrt(2*(P - Pa)/(p.rho_w*p.factor));           % Bernoulli
        Q   = p.Cd_n*p.An*u;                                 % caudal
        T   = p.rho_w*Q*u;
        dVw = -Q;
    else
        Taire   = P/(rho_a*p.R);
        critico = ((p.gamma + 1)/2)^(p.gamma/(p.gamma - 1));
        if P/Pa >= critico                                   % flujo sónico
            Te = 2*Taire/(p.gamma + 1);  Pe = P/critico;  ue = sqrt(p.gamma*p.R*Te);
            mdot = p.Cd_n*p.An*(Pe/(p.R*Te))*ue;
            T = mdot*ue + (Pe - Pa)*p.An;
        else                                                 % flujo subsónico
            Te = Taire*(Pa/P)^((p.gamma - 1)/p.gamma);
            ue = sqrt(2*p.gamma/(p.gamma - 1)*p.R*(Taire - Te));
            mdot = p.Cd_n*p.An*(Pa/(p.R*Te))*ue;
            T = mdot*ue;
        end
        dma = -mdot;
    end
end
` : ""}
function y_nuevo = paso_euler(f, t, y, dt, p)
    y_nuevo = y + dt*f(t, y, p);
end

function y_nuevo = paso_rk4(f, t, y, dt, p)
    k1 = f(t,        y,           p);
    k2 = f(t + dt/2, y + dt/2*k1, p);
    k3 = f(t + dt/2, y + dt/2*k2, p);
    k4 = f(t + dt,   y + dt*k3,   p);
    y_nuevo = y + dt/6*(k1 + 2*k2 + 2*k3 + k4);
end

function sombrear_fases(r)
% Sombrea las cuatro fases del vuelo en la gráfica actual.
    t_fin = r.t(end);
    if isnan(r.t_par)
        f = [0 r.t_b; r.t_b r.t_apogeo; r.t_apogeo t_fin; NaN NaN];
    elseif r.t_par < r.t_apogeo
        f = [0 r.t_b; r.t_b r.t_par; NaN NaN; r.t_par t_fin];
    else
        f = [0 r.t_b; r.t_b r.t_apogeo; r.t_apogeo r.t_par; r.t_par t_fin];
    end
    colores = [0.88 0.44 0.11; 0 0.22 0.65; 0.36 0.38 0.44; 0.11 0.48 0.24];
    yl = ylim;  hold on;
    for k = 1:4
        if any(isnan(f(k,:))) || f(k,2) <= f(k,1), continue; end
        h = patch([f(k,1) f(k,2) f(k,2) f(k,1)], [yl(1) yl(1) yl(2) yl(2)], colores(k,:), ...
                  'FaceAlpha', 0.12, 'EdgeColor', 'none', 'HandleVisibility', 'off');
        uistack(h, 'bottom');
        xl = xlim;
        if f(k,2) - f(k,1) > 0.05*(xl(2) - xl(1))         % rotular solo si cabe
            text(f(k,1), yl(2), sprintf(' Fase %d', k), 'VerticalAlignment', 'top', 'FontSize', 8);
        end
    end
    ylim(yl);  hold off;
end
`;

  return header + propulsion + math + compute + functions;
}

export function downloadMatlab(d: Design, r: FlightResult) {
  downloadFile(matlabFileName(d.name), matlabScript(d, r), "text/plain");
}
