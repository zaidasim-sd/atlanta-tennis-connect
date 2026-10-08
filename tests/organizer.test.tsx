import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {describe,it,expect,vi,beforeEach} from 'vitest';
import type {ComponentType} from 'react';
import {Route} from '@/routes/organizer';
const navigate=vi.hoisted(()=>vi.fn());
vi.mock('@tanstack/react-router',()=>({createFileRoute:()=> (options:unknown)=>({options}),useNavigate:()=>navigate}));
vi.mock('@/lib/store',()=>({useStore:()=>store,getApiUrl:(path:string)=>path}));
const league={id:'open',name:'Open League',format:'men-singles',skillLevel:'3.5',seasonId:'fall',registrationOpen:true,playerLimit:16,spotsRemaining:10,registeredCount:6,feeCents:3000,venue:'Park',scheduleDay:'Saturday',scheduleTime:'9 AM',description:'Test'};
const toggle=vi.fn();
const store={hydrated:true,user:{id:'org',name:'Organizer',role:'organizer'},seasons:[{id:'fall',name:'Fall',status:'active'}],leagues:[league,{...league,id:'closed',name:'Closed League',registrationOpen:false},{...league,id:'full',name:'Full League',spotsRemaining:0},{...league,id:'wait',name:'Wait League',registrationStatus:'waitlist'}],registrations:[],players:[],matches:[],results:[],toggleRegistration:toggle};
const Page=Route.options.component as ComponentType;
beforeEach(()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>({ok:true,data:[]})} as Response);toggle.mockClear();});
async function open(){render(<Page/>);await waitFor(()=>expect(screen.getByRole('tab',{name:'Manage Leagues'})).toBeTruthy());}
describe('organizer league management',()=>{
 it('opens the participant popup from the full-card action with usable search and filters',async()=>{
  await open();fireEvent.click(screen.getByRole('button',{name:'View participants for Open League'}));
  expect(screen.getByRole('dialog',{name:'Open League'})).toBeTruthy();
  expect(screen.getByRole('searchbox',{name:'Search participants'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'Copy Emails'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Paid (0)'}));
  expect(screen.getByRole('button',{name:'Paid (0)'}).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button',{name:'All (0)'}).getAttribute('aria-pressed')).toBe('false');
 });
 it('opens mobile filters and applies a selected status',async()=>{
  await open();fireEvent.click(screen.getByRole('button',{name:/Filters/}));
  const dialog=screen.getByRole('dialog',{name:'Filter leagues'});
  const select=dialog.querySelector('select[aria-label="Filter league status"]')!;
  fireEvent.change(select,{target:{value:'closed'}});
  fireEvent.click(screen.getByRole('button',{name:'Show 1 league'}));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('1 of 4 leagues')).toBeTruthy();
 });
 it('defaults to open leagues and supports status and search filters',async()=>{
  await open(); expect(screen.getByText('1 of 4 leagues')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Filter league status'),{target:{value:'full'}});expect(screen.getAllByText('Full League').length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Filter league status'),{target:{value:'waitlist'}});expect(screen.getAllByText('Wait League').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button',{name:'Show all leagues'}));
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Closed League'}});expect(screen.getByText('1 of 4 leagues')).toBeTruthy();
 });
 it('switches every organizer tab and supports arrow navigation',async()=>{
  await open();fireEvent.click(screen.getByRole('tab',{name:'Atlanta Geography'}));expect(screen.getByRole('tabpanel').id).toBe('organizer-panel-geography');
  fireEvent.click(screen.getByRole('tab',{name:'Create League'}));expect(screen.getByRole('heading',{name:'Create New League'})).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('tab',{name:'Create League'}),{key:'ArrowRight'});expect(screen.getByRole('tabpanel').id).toBe('organizer-panel-leagues');
 });
 it('labels the registration action and avoids opening the roster when toggled',async()=>{
  await open();fireEvent.click(screen.getByRole('button',{name:'Close registration'}));expect(toggle).toHaveBeenCalledWith('open');expect(screen.queryByRole('dialog')).toBeNull();
 });
});

