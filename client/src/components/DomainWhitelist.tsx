import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getDomains, addDomain, toggleDomainStatus, deleteDomain, checkDomain } from '@/lib/api';
import { Domain } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DomainWhitelist: React.FC = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [checkDomainInput, setCheckDomainInput] = useState<string>('');
  const [checkResult, setCheckResult] = useState<{domain: string, whitelisted: boolean} | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const { toast } = useToast();
  
  useEffect(() => {
    fetchDomains();
  }, []);
  
  const fetchDomains = async () => {
    setLoading(true);
    try {
      const domainsData = await getDomains();
      setDomains(domainsData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load domains",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddDomain = async () => {
    if (!newDomain) {
      toast({
        title: "Error",
        description: "Please enter a domain name",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await addDomain(newDomain);
      toast({
        title: "Success",
        description: `Domain ${newDomain} added successfully`,
      });
      setNewDomain('');
      fetchDomains();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add domain",
        variant: "destructive"
      });
    }
  };
  
  const handleToggleStatus = async (id: number) => {
    try {
      await toggleDomainStatus(id);
      toast({
        title: "Success",
        description: "Domain status updated",
      });
      fetchDomains();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update domain status",
        variant: "destructive"
      });
    }
  };
  
  const handleDelete = async (id: number) => {
    try {
      await deleteDomain(id);
      toast({
        title: "Success",
        description: "Domain deleted successfully",
      });
      fetchDomains();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete domain",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Domain Whitelist</h3>
      <div className="bg-darkAccent p-4 rounded-lg">
        <div className="flex mb-3">
          <input 
            type="text" 
            placeholder="Add new domain (e.g., example.com)" 
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            className="flex-grow bg-darkSecondary border border-gray-600 rounded-l px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button 
            className="bg-primary hover:bg-secondary text-white py-2 px-4 rounded-r transition-colors focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            onClick={handleAddDomain}
          >
            Add
          </button>
        </div>
        <div className="max-h-48 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-2">Domain</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-2">Status</th>
                  <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {domains.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-400">
                      No domains in whitelist
                    </td>
                  </tr>
                ) : (
                  domains.map((domain) => (
                    <tr key={domain.id}>
                      <td className="py-2 text-sm">{domain.domain}</td>
                      <td className="py-2">
                        <button
                          onClick={() => handleToggleStatus(domain.id)}
                          className={`px-2 py-1 ${domain.active ? 'bg-green-500' : 'bg-yellow-500'} text-xs text-white rounded cursor-pointer`}
                        >
                          {domain.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-2 text-right">
                        <button 
                          className="text-red-400 hover:text-red-300"
                          onClick={() => handleDelete(domain.id)}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DomainWhitelist;
