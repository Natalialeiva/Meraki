(function (raiz) {
    // El servidor determina la propietaria; el formulario solo envía campos editables.
    const campos = ['nombre', 'descripcion', 'direccion', 'comuna', 'telefono'];
    function montar({form, estado, selector, api, alGuardar}) {
        const grupo = form.querySelector('fieldset');
        const entradas = Object.fromEntries(campos.map(campo => [campo, form.elements.namedItem(campo)]));
        let actual = null;
        let guardando = false;

        function cargar(negocio) {
            actual = negocio || null;
            grupo.disabled = !actual;
            for (const campo of campos) entradas[campo].value = actual?.[campo] ?? '';
            estado.textContent = actual ? 'Edita los datos públicos de tu emprendimiento.' : 'No tienes un emprendimiento disponible para editar.';
        }

        form.onsubmit = async evento => {
            evento.preventDefault();
            if (!actual || guardando || !form.reportValidity()) return;
            const id = actual.id_emprendimiento;
            const datos = Object.fromEntries(campos.map(campo => {
                const valor = entradas[campo].value.trim();
                return [campo, campo === 'nombre' ? valor : valor || null];
            }));
            // Los espacios no constituyen un nombre, aunque el navegador acepte el campo.
            if (!datos.nombre) {
                estado.textContent = 'Indica el nombre del emprendimiento.';
                entradas.nombre.focus();
                return;
            }
            guardando = true;
            grupo.disabled = true;
            selector.disabled = true;
            estado.textContent = 'Guardando perfil…';
            try {
                const respuesta = await api('/api/emprendimientos/' + id, 'PATCH', datos);
                actual = respuesta.emprendimiento;
                alGuardar(actual);
                cargar(actual);
                estado.textContent = 'Perfil guardado correctamente.';
            } catch (error) {
                // Conservamos lo escrito para que se pueda corregir o volver a intentar.
                estado.textContent = error.message;
            } finally {
                guardando = false;
                grupo.disabled = !actual;
                selector.disabled = false;
            }
        };
        form.querySelector('[data-restaurar-perfil]').onclick = () => {
            if (!guardando) cargar(actual);
        };
        cargar(null);
        return {cargar};
    }
    const modulo = {montar};
    if (typeof module !== 'undefined' && module.exports) module.exports = modulo;
    else raiz.MerakiPerfil = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this);
