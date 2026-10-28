function crearElemento(tipo, propiedades, ...hijos) {
    const props = propiedades || {};
    const hijosValidos = hijos
        .flat(Infinity)
        .filter((hijo) => hijo != null && typeof hijo !== "boolean")
        .map((hijo) => (typeof hijo === "object" ? hijo : String(hijo)));

    if (typeof tipo === "function") {
        return tipo({ ...props, hijos: hijosValidos });
    }

    return { tipo, propiedades: props, hijos: hijosValidos };
}

function esEvento(nombre) {
    return /^on[A-Z]/.test(nombre);
}

function nombreEvento(nombre) {
    return nombre.slice(2).toLowerCase();
}

function actualizarEstilo(nodo, viejo = {}, nuevo = {}) {
    for (const regla in viejo) {
        if (!(regla in nuevo)) {
            nodo.style[regla] = "";
        }
    }

    for (const regla in nuevo) {
        if (viejo[regla] !== nuevo[regla]) {
            nodo.style[regla] = nuevo[regla];
        }
    }
}

function quitarPropiedad(nodo, nombre, valorViejo) {
    if (esEvento(nombre)) {
        nodo.removeEventListener(nombreEvento(nombre), valorViejo);
    } else if (nombre === "style") {
        nodo.style.cssText = "";
    } else if (nombre in nodo) {
        nodo[nombre] = typeof nodo[nombre] === "boolean" ? false : "";
    } else {
        nodo.removeAttribute(nombre);
    }
}

function ponerPropiedad(nodo, nombre, valorViejo, valorNuevo) {
    if (esEvento(nombre)) {
        if (valorViejo) {
            nodo.removeEventListener(nombreEvento(nombre), valorViejo);
        }
        nodo.addEventListener(nombreEvento(nombre), valorNuevo);
    } else if (nombre in nodo) {
        nodo[nombre] = valorNuevo;
    } else {
        nodo.setAttribute(nombre, valorNuevo);
    }
}

function actualizarPropiedades(nodo, viejas, nuevas) {
    for (const nombre in viejas) {
        if (!(nombre in nuevas)) {
            quitarPropiedad(nodo, nombre, viejas[nombre]);
        }
    }

    for (const nombre in nuevas) {
        if (nombre === "style") {
            actualizarEstilo(nodo, viejas.style, nuevas.style);
            continue;
        }

        const cambio = viejas[nombre] !== nuevas[nombre];
        const formularioDesfasado =
            (nombre === "value" || nombre === "checked") && nodo[nombre] !== nuevas[nombre];

        if (cambio || formularioDesfasado) {
            ponerPropiedad(nodo, nombre, viejas[nombre], nuevas[nombre]);
        }
    }
}

function crearNodoDom(nodoVirtual) {
    if (typeof nodoVirtual === "string") {
        return document.createTextNode(nodoVirtual);
    }

    const nodo = document.createElement(nodoVirtual.tipo);
    actualizarPropiedades(nodo, {}, nodoVirtual.propiedades);
    nodoVirtual.hijos.forEach((hijo) => nodo.appendChild(crearNodoDom(hijo)));

    return nodo;
}

function patch(padre, nodoReal, viejo, nuevo) {
    const viejoEsTexto = typeof viejo === "string";
    const nuevoEsTexto = typeof nuevo === "string";

    if (viejoEsTexto && nuevoEsTexto) {
        if (viejo !== nuevo) {
            nodoReal.nodeValue = nuevo;
        }
        return;
    }

    if (viejoEsTexto || nuevoEsTexto || viejo.tipo !== nuevo.tipo) {
        padre.replaceChild(crearNodoDom(nuevo), nodoReal);
        return;
    }

    actualizarPropiedades(nodoReal, viejo.propiedades, nuevo.propiedades);
    patchHijos(nodoReal, viejo.hijos, nuevo.hijos);
}

function patchHijos(padre, viejos, nuevos) {
    for (let i = viejos.length - 1; i >= nuevos.length; i--) {
        padre.removeChild(padre.childNodes[i]);
    }

    nuevos.forEach((nuevo, i) => {
        if (i < viejos.length) {
            patch(padre, padre.childNodes[i], viejos[i], nuevo);
        } else {
            padre.appendChild(crearNodoDom(nuevo));
        }
    });
}

function renderizar(nodoVirtual, contenedor) {
    if (contenedor.arbolAnterior) {
        patch(contenedor, contenedor.firstChild, contenedor.arbolAnterior, nodoVirtual);
    } else {
        contenedor.innerHTML = "";
        contenedor.appendChild(crearNodoDom(nodoVirtual));
    }

    contenedor.arbolAnterior = nodoVirtual;
}

function crearAlmacen(reducer, estadoInicial) {
    let estado = estadoInicial;
    const oyentes = new Set();

    return {
        getState: () => estado,
        dispatch: (accion) => {
            const nuevoEstado = reducer(estado, accion);

            if (nuevoEstado === estado) {
                return;
            }

            estado = nuevoEstado;
            oyentes.forEach((oyente) => oyente(estado));
        },
        subscribe: (oyente) => {
            oyentes.add(oyente);
            return () => oyentes.delete(oyente);
        },
    };
}

function crearAplicacion(componente, contenedor, almacen) {
    function dibujar() {
        renderizar(
            componente({ estado: almacen.getState(), dispatch: almacen.dispatch }),
            contenedor
        );
    }

    almacen.subscribe(dibujar);
    dibujar();
}

export { crearElemento, renderizar, crearAlmacen, crearAplicacion };